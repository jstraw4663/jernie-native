import { stripUndefined } from '@/src/utils/stripUndefined';
import type { ItineraryDay, ItineraryItem, ItineraryItemCategory } from '@/src/types';

export interface CustomItineraryItemInput {
  label: string;
  time?: string;
  category?: ItineraryItemCategory;
  notes?: string;
}

// Pure builder, mirrors buildAddToItineraryItem (domain/explore.ts) but for free-text
// custom items. Caller supplies `id` to keep this side-effect-free/testable.
export function buildCustomItineraryItem(
  input: CustomItineraryItemInput,
  existingItemsInDay: ItineraryItem[],
  id: string,
): ItineraryItem {
  const order = existingItemsInDay.length > 0
    ? Math.max(...existingItemsInDay.map(i => i.order)) + 1
    : 0;
  return stripUndefined({
    id,
    type: 'custom',
    label: input.label,
    time: input.time,
    category: input.category,
    notes: input.notes,
    order,
  }) as ItineraryItem;
}

// ── Day generation ───────────────────────────────────────────────────────────

export interface SyncItineraryDaysInput {
  stopId: string;
  dates: { start: string; end: string };
  existingDays: ItineraryDay[];
  /** Injected so this stays pure and testable, mirroring buildCustomItineraryItem. */
  generateId: () => string;
}

export interface SyncItineraryDaysResult {
  toAdd: ItineraryDay[];
  toRemoveIds: string[];
}

// Local-date arithmetic, never UTC — `new Date('2026-08-10')` is UTC midnight, which reads
// as the previous day west of Greenwich and would shift every generated date by one.
function addDaysISO(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const next = new Date(y, m - 1, d + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

/**
 * Reconciles a stop's itinerary days against its date range: one day per date, inclusive.
 *
 * Additive by default. Days that fall outside the new range are dropped ONLY when empty —
 * a day still holding items is kept even when out of range, so shortening a stop can never
 * silently destroy what the user entered. (Removing those is a deliberate, separate action.)
 *
 * Pure: returns the writes to perform rather than performing them.
 */
export function syncItineraryDaysForRange({
  stopId, dates, existingDays, generateId,
}: SyncItineraryDaysInput): SyncItineraryDaysResult {
  const wanted: string[] = [];
  // Guard against an inverted range — without it the cursor never reaches `end` and loops forever.
  if (dates.start <= dates.end) {
    for (let cursor = dates.start; cursor <= dates.end; cursor = addDaysISO(cursor, 1)) {
      wanted.push(cursor);
    }
  }

  const existingDates = new Set(existingDays.map(d => d.dateIso));
  const toAdd = wanted
    .filter(dateIso => !existingDates.has(dateIso))
    .map(dateIso => ({ id: generateId(), stopId, dateIso, items: [] as ItineraryItem[] }));

  const wantedSet = new Set(wanted);
  const toRemoveIds = existingDays
    .filter(d => !wantedSet.has(d.dateIso) && d.items.length === 0)
    .map(d => d.id);

  return { toAdd, toRemoveIds };
}
