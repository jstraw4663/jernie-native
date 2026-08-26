import { database, getAuthedUser } from '@/src/lib/firebase';
import type { FirebaseDatabaseTypes } from '@react-native-firebase/database';
import { generateId } from '@/src/utils/id';
import { stripUndefined } from '@/src/utils/stripUndefined';
import { buildAddToItineraryItem } from '@/src/domain/explore';
import {
  buildCustomItineraryItem, moveItineraryItemBetweenDays as moveItemsBetweenDays,
  reorderItineraryItems,
  type CustomItineraryItemInput, type ItineraryItemDrop, type ItineraryItemMove,
} from '@/src/domain/itinerary';
import type { ItineraryDay, ItineraryItem, Place } from '@/src/types';

/**
 * Adds a place to the itinerary on the given day. `useTripData` is fetch-once, not a
 * live listener, so callers should call TripContext's `refetch()` afterward to see the
 * new item reflected — a brief round trip rather than optimistic local-merge state.
 */
export async function addPlaceToItinerary(tripId: string, place: Place, day: ItineraryDay): Promise<void> {
  const newItem = buildAddToItineraryItem(place, day.items, generateId());
  await database()
    .ref(`trips/${tripId}/itinerary/${day.stopId}/${day.id}/items`)
    .set([...day.items, newItem]);
}

/** Adds a free-text custom item to the itinerary on the given day. */
export async function addCustomItineraryItem(
  tripId: string,
  day: ItineraryDay,
  input: CustomItineraryItemInput,
): Promise<void> {
  await getAuthedUser();
  const newItem = buildCustomItineraryItem(input, day.items, generateId());
  await database().ref(`trips/${tripId}/itinerary/${day.stopId}/${day.id}/items`).set([...day.items, newItem]);
}

export type ItineraryItemPatch = Partial<Omit<ItineraryItem, 'id' | 'type' | 'placeId' | 'bookingId'>>;

/** Type-agnostic patch: works identically for 'place', 'booking', and 'custom' items. */
export async function updateItineraryItem(
  tripId: string,
  day: ItineraryDay,
  itemId: string,
  patch: ItineraryItemPatch,
): Promise<void> {
  await getAuthedUser();
  const cleaned = stripUndefined(patch);
  const updatedItems = day.items.map(i => (i.id === itemId ? { ...i, ...cleaned } : i));
  await database().ref(`trips/${tripId}/itinerary/${day.stopId}/${day.id}/items`).set(updatedItems);
}

/** Type-agnostic remove: works identically for 'place', 'booking', and 'custom' items. */
export async function removeItineraryItem(tripId: string, day: ItineraryDay, itemId: string): Promise<void> {
  await getAuthedUser();
  const remaining = day.items.filter(i => i.id !== itemId);
  await database().ref(`trips/${tripId}/itinerary/${day.stopId}/${day.id}/items`).set(remaining);
}

function itemsFromSnapshot(raw: unknown): ItineraryItem[] {
  if (Array.isArray(raw)) return raw.filter(Boolean) as ItineraryItem[];
  return Object.values((raw ?? {}) as Record<string, ItineraryItem>);
}

const EXISTING_ITEM_TRANSACTION_ATTEMPTS = 2;

class ItineraryItemsTransactionAbortedError extends Error {
  constructor() {
    super('Firebase repeatedly aborted an existing-item transaction');
    this.name = 'ItineraryItemsTransactionAbortedError';
  }
}

/** A user-actionable classification; arbitrary Firebase messages stay out of the UI. */
export class ItineraryMoveWriteError extends Error {
  constructor(readonly reason: 'item-missing' | 'destination-missing' | 'not-committed') {
    super(reason === 'item-missing'
      ? 'Itinerary item no longer exists'
      : reason === 'destination-missing'
        ? 'Itinerary destination day no longer exists'
        : 'Itinerary move could not be committed');
    this.name = 'ItineraryMoveWriteError';
  }
}

/**
 * Runs an item transform without ever treating an uncached `null` as permission to recreate a
 * deleted day. RTDB may call a transaction updater with `null` before its server value reaches
 * the local cache. Returning `undefined` is the only safe response in that pass, but it reports
 * `committed: false`; a fresh existence check distinguishes that cache abort from a real delete.
 */
async function transactOnExistingItem(
  itemsRef: FirebaseDatabaseTypes.Reference,
  itemId: string,
  transform: (items: ItineraryItem[]) => ItineraryItem[],
): Promise<'committed' | 'item-missing'> {
  let keepingSynced = false;
  try {
    // Keep the native cache warm for the complete transaction window. `once()` alone returns
    // the right snapshot but does not guarantee the transaction's first native callback has it.
    await itemsRef.keepSynced(true);
    keepingSynced = true;

    const initial = itemsFromSnapshot((await itemsRef.once('value')).val());
    if (!initial.some(item => item.id === itemId)) return 'item-missing';

    for (let attempt = 0; attempt < EXISTING_ITEM_TRANSACTION_ATTEMPTS; attempt += 1) {
      const result = await itemsRef.transaction((raw: unknown) => {
        if (raw === null || raw === undefined) return undefined;
        const current = itemsFromSnapshot(raw);
        if (!current.some(item => item.id === itemId)) return undefined;
        return transform(current);
      });
      if (result.committed) return 'committed';

      // A real deletion stays deleted. If the item still exists, this was an empty-cache abort;
      // the read also primes the native cache before the bounded retry.
      const latest = itemsFromSnapshot((await itemsRef.once('value')).val());
      if (!latest.some(item => item.id === itemId)) return 'item-missing';
    }

    throw new ItineraryItemsTransactionAbortedError();
  } finally {
    if (keepingSynced) {
      // Cache retention is scoped to the write. A cleanup failure must not turn a committed move
      // into a visible save failure, so this best-effort release deliberately does not rethrow.
      await itemsRef.keepSynced(false).catch(() => undefined);
    }
  }
}

/**
 * Idempotently removes one item from the latest server day. This is the delayed-commit
 * delete path: it never writes a potentially visibility-filtered UI copy of the day.
 *
 * A transaction rather than read-then-set, matching `reorderItineraryDayItems` below — the
 * Undo window is four seconds wide, and a read-then-set would drop anything a companion added
 * to the same day in between. Warming the reference first avoids treating an uncached
 * transaction's initial null as a deleted day.
 */
export async function removeItineraryItemById(
  tripId: string,
  stopId: string,
  dayId: string,
  itemId: string,
): Promise<void> {
  await getAuthedUser();
  const itemsRef = database().ref(`trips/${tripId}/itinerary/${stopId}/${dayId}/items`);
  // Already gone is success, not a race: Retry after a failed commit lands here.
  await transactOnExistingItem(
    itemsRef,
    itemId,
    current => current.filter(item => item.id !== itemId),
  );
}

/**
 * Reorders against the latest complete server array in an RTDB transaction. Warming the
 * reference first avoids treating an uncached transaction's initial null value as a deleted
 * day; the transaction still retries our pure transform if another client wins the race.
 */
export async function reorderItineraryDayItems(
  tripId: string,
  stopId: string,
  dayId: string,
  move: ItineraryItemMove,
): Promise<void> {
  await getAuthedUser();
  const itemsRef = database().ref(`trips/${tripId}/itinerary/${stopId}/${dayId}/items`);
  try {
    const result = await transactOnExistingItem(
      itemsRef,
      move.itemId,
      current => reorderItineraryItems(current, move),
    );
    if (result === 'item-missing') throw new ItineraryMoveWriteError('item-missing');
  } catch (error) {
    if (error instanceof ItineraryMoveWriteError) throw error;
    if (error instanceof ItineraryItemsTransactionAbortedError) {
      throw new ItineraryMoveWriteError('not-committed');
    }
    throw error;
  }
}

export interface ItineraryDayLocation {
  stopId: string;
  dayId: string;
}

type RawItineraryDay = Record<string, unknown> & { items?: unknown };
type RawItineraryRoot = Record<string, Record<string, RawItineraryDay>>;

function rawDayAt(
  root: RawItineraryRoot,
  location: ItineraryDayLocation,
): RawItineraryDay | undefined {
  return root[location.stopId]?.[location.dayId];
}

function crossDayState(
  raw: unknown,
  source: ItineraryDayLocation,
  destination: ItineraryDayLocation,
  itemId: string,
): 'ready' | 'item-missing' | 'destination-missing' {
  const root = (raw ?? {}) as RawItineraryRoot;
  const sourceDay = rawDayAt(root, source);
  if (!sourceDay || !itemsFromSnapshot(sourceDay.items).some(item => item.id === itemId)) {
    return 'item-missing';
  }
  return rawDayAt(root, destination) ? 'ready' : 'destination-missing';
}

function applyCrossDayMove(
  raw: unknown,
  source: ItineraryDayLocation,
  destination: ItineraryDayLocation,
  drop: ItineraryItemDrop,
): RawItineraryRoot | undefined {
  if (raw === null || raw === undefined) return undefined;
  const root = raw as RawItineraryRoot;
  const sourceDay = rawDayAt(root, source);
  const destinationDay = rawDayAt(root, destination);
  if (!sourceDay || !destinationDay) return undefined;
  const sourceItems = itemsFromSnapshot(sourceDay.items);
  if (!sourceItems.some(item => item.id === drop.itemId)) return undefined;

  const moved = moveItemsBetweenDays(
    sourceItems,
    itemsFromSnapshot(destinationDay.items),
    drop,
  );
  const nextRoot = { ...root };
  const nextSourceStop = { ...root[source.stopId] };
  nextSourceStop[source.dayId] = { ...sourceDay, items: moved.sourceItems };
  nextRoot[source.stopId] = nextSourceStop;

  const nextDestinationStop = source.stopId === destination.stopId
    ? nextSourceStop
    : { ...root[destination.stopId] };
  nextDestinationStop[destination.dayId] = {
    ...destinationDay,
    items: moved.destinationItems,
  };
  nextRoot[destination.stopId] = nextDestinationStop;
  return nextRoot;
}

/**
 * Moves an item between two persisted days in one transaction at their common itinerary root.
 * The source removal and destination insert therefore commit together, including when the days
 * belong to different stops. Destination anchors are resolved again against the latest server
 * arrays so a companion edit cannot silently duplicate or discard an item.
 */
export async function moveItineraryItemBetweenDays(
  tripId: string,
  source: ItineraryDayLocation,
  destination: ItineraryDayLocation,
  drop: ItineraryItemDrop,
): Promise<void> {
  await getAuthedUser();
  if (source.stopId === destination.stopId && source.dayId === destination.dayId) {
    throw new Error('Cross-day move requires two different itinerary days');
  }

  const itineraryRef = database().ref(`trips/${tripId}/itinerary`);
  let keepingSynced = false;
  try {
    await itineraryRef.keepSynced(true);
    keepingSynced = true;
    const initialRaw = (await itineraryRef.once('value')).val();
    const initialState = crossDayState(initialRaw, source, destination, drop.itemId);
    if (initialState !== 'ready') throw new ItineraryMoveWriteError(initialState);

    for (let attempt = 0; attempt < EXISTING_ITEM_TRANSACTION_ATTEMPTS; attempt += 1) {
      const result = await itineraryRef.transaction((raw: unknown) => (
        applyCrossDayMove(raw, source, destination, drop)
      ));
      if (result.committed) return;

      const latestRaw = (await itineraryRef.once('value')).val();
      const latestState = crossDayState(latestRaw, source, destination, drop.itemId);
      if (latestState !== 'ready') throw new ItineraryMoveWriteError(latestState);
    }
    throw new ItineraryMoveWriteError('not-committed');
  } catch (error) {
    if (error instanceof ItineraryMoveWriteError) throw error;
    throw error;
  } finally {
    if (keepingSynced) await itineraryRef.keepSynced(false).catch(() => undefined);
  }
}
