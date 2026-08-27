import { createMMKV } from 'react-native-mmkv';
import type { Candidate } from '@/src/domain/candidate';

/**
 * The add sheet's tray: candidates a traveller has built up but not yet committed.
 *
 * MMKV-backed rather than component state, because a batch is assembled over minutes —
 * search, tap, search again — and the design's promise is "Add 3 items writes once and
 * offers one undo". Losing half of that to a backgrounded app the OS reaped is exactly the
 * failure that promise is making. Nothing here touches RTDB; the tray is client-only until
 * `commitCandidates` (src/lib/addFlowWrites.ts) writes the whole thing in one update.
 *
 * Deliberately a plain module with a subscribe hook rather than a context: it mirrors
 * src/lib/writeQueue.ts, which is the app's existing persisted-store shape, and it means
 * the tray can be read from a write path without a component in scope.
 */

export const TRAY_STORAGE_KEY = 'jernie_add_tray';

/**
 * Bump when `Candidate` or `CommitPayload` changes shape in a way an older tray would not
 * satisfy. A stored tray outlives an app update, which an in-memory one never could, and
 * each candidate carries a `commit` payload that goes straight into a multi-path RTDB
 * update — so a stale entry is not a rendering glitch, it is a malformed write to the
 * user's trip. Dropping the tray costs someone a re-add; committing a stale one corrupts
 * data, and it is not a close call.
 */
export const TRAY_VERSION = 1;

const storage = createMMKV({ id: 'jernie-add-tray' });

/** Trays are keyed by trip: an app killed mid-add can reopen anywhere. */
type TrayMap = Record<string, Candidate[]>;

interface StoredTray {
  version: number;
  trays: TrayMap;
}

function loadAll(): TrayMap {
  try {
    const raw = storage.getString(TRAY_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as StoredTray;
    if (parsed?.version !== TRAY_VERSION) return {};
    // `typeof null === 'object'`, hence the explicit null check.
    if (typeof parsed.trays !== 'object' || parsed.trays === null || Array.isArray(parsed.trays)) {
      return {};
    }

    return parsed.trays;
  } catch {
    // Unparseable storage is treated as an empty tray rather than an error. The next write
    // overwrites it with a well-formed payload, so a corrupt value cannot wedge the sheet.
    return {};
  }
}

function saveAll(trays: TrayMap): void {
  const payload: StoredTray = { version: TRAY_VERSION, trays };
  storage.set(TRAY_STORAGE_KEY, JSON.stringify(payload));
  notifySubscribers();
}

/**
 * The pending candidates for one trip, in the order they were added.
 *
 * Scoped by trip on purpose. Showing one trip's pending items while another is open would
 * be confusing; committing them there would write a booking into the wrong holiday.
 */
export function getTray(tripId: string): Candidate[] {
  return loadAll()[tripId] ?? [];
}

/**
 * Adds a candidate, replacing any entry that already has its id.
 *
 * Ids are generated per built candidate, so a genuine collision should not arise — but a
 * double-tap must not put the same place in a batch twice and then write both.
 */
export function addToTray(tripId: string, candidate: Candidate): void {
  const trays = loadAll();
  const existing = trays[tripId] ?? [];
  const index = existing.findIndex(c => c.id === candidate.id);

  const next = index === -1
    ? [...existing, candidate]
    : existing.map(c => (c.id === candidate.id ? candidate : c));

  saveAll({ ...trays, [tripId]: next });
}

export function removeFromTray(tripId: string, candidateId: string): void {
  const trays = loadAll();
  const existing = trays[tripId];
  if (!existing) return;

  saveAll({ ...trays, [tripId]: existing.filter(c => c.id !== candidateId) });
}

/** Empties one trip's tray — what a successful commit does, and what discarding does. */
export function clearTray(tripId: string): void {
  const trays = loadAll();
  if (!trays[tripId]) return;

  saveAll({ ...trays, [tripId]: [] });
}

type Subscriber = () => void;
const subscribers = new Set<Subscriber>();

function notifySubscribers(): void {
  subscribers.forEach(fn => fn());
}

/**
 * Called after every change. Deliberately passes nothing: a subscriber that cares about one
 * trip re-reads `getTray(tripId)` itself, which keeps this store from having to know which
 * trip anyone is looking at.
 */
export function subscribe(fn: Subscriber): () => void {
  subscribers.add(fn);
  return () => { subscribers.delete(fn); };
}
