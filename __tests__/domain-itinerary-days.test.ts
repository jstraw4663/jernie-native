import { syncItineraryDaysForRange } from '@/src/domain/itinerary';
import type { ItineraryDay } from '@/src/types';

function day(id: string, dateIso: string, itemCount = 0): ItineraryDay {
  return {
    id,
    stopId: 'stop-1',
    dateIso,
    items: Array.from({ length: itemCount }, (_, i) => ({ id: `${id}-i${i}`, type: 'custom' as const, label: 'x', order: i })),
  };
}

// Deterministic ids so assertions can name them.
function idFactory() {
  let n = 0;
  return () => `gen-${n++}`;
}

describe('syncItineraryDaysForRange — creating days', () => {
  test('generates one day per date, inclusive of both endpoints', () => {
    const { toAdd, toRemoveIds } = syncItineraryDaysForRange({
      stopId: 'stop-1',
      dates: { start: '2026-08-10', end: '2026-08-13' },
      existingDays: [],
      generateId: idFactory(),
    });

    expect(toAdd.map(d => d.dateIso)).toEqual(['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13']);
    expect(toRemoveIds).toEqual([]);
  });

  test('a single-date stop yields exactly one day', () => {
    const { toAdd } = syncItineraryDaysForRange({
      stopId: 'stop-1',
      dates: { start: '2026-08-10', end: '2026-08-10' },
      existingDays: [],
      generateId: idFactory(),
    });
    expect(toAdd).toHaveLength(1);
    expect(toAdd[0].dateIso).toBe('2026-08-10');
  });

  test('new days carry the stop id and an empty items array', () => {
    const { toAdd } = syncItineraryDaysForRange({
      stopId: 'stop-7',
      dates: { start: '2026-08-10', end: '2026-08-10' },
      existingDays: [],
      generateId: idFactory(),
    });
    expect(toAdd[0]).toEqual({ id: 'gen-0', stopId: 'stop-7', dateIso: '2026-08-10', items: [] });
  });

  test('crosses a month boundary correctly', () => {
    const { toAdd } = syncItineraryDaysForRange({
      stopId: 'stop-1',
      dates: { start: '2026-08-30', end: '2026-09-02' },
      existingDays: [],
      generateId: idFactory(),
    });
    expect(toAdd.map(d => d.dateIso)).toEqual(['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02']);
  });

  test('crosses a year boundary correctly', () => {
    const { toAdd } = syncItineraryDaysForRange({
      stopId: 'stop-1',
      dates: { start: '2026-12-31', end: '2027-01-01' },
      existingDays: [],
      generateId: idFactory(),
    });
    expect(toAdd.map(d => d.dateIso)).toEqual(['2026-12-31', '2027-01-01']);
  });

  test('an end date before the start yields nothing rather than looping forever', () => {
    const { toAdd, toRemoveIds } = syncItineraryDaysForRange({
      stopId: 'stop-1',
      dates: { start: '2026-08-13', end: '2026-08-10' },
      existingDays: [],
      generateId: idFactory(),
    });
    expect(toAdd).toEqual([]);
    expect(toRemoveIds).toEqual([]);
  });
});

describe('syncItineraryDaysForRange — reconciling an existing itinerary', () => {
  const existing = [day('d1', '2026-08-10', 2), day('d2', '2026-08-11'), day('d3', '2026-08-12', 1)];

  test('is a no-op when the range already matches', () => {
    const { toAdd, toRemoveIds } = syncItineraryDaysForRange({
      stopId: 'stop-1',
      dates: { start: '2026-08-10', end: '2026-08-12' },
      existingDays: existing,
      generateId: idFactory(),
    });
    expect(toAdd).toEqual([]);
    expect(toRemoveIds).toEqual([]);
  });

  test('adds only the dates that are missing, leaving existing days untouched', () => {
    const { toAdd, toRemoveIds } = syncItineraryDaysForRange({
      stopId: 'stop-1',
      dates: { start: '2026-08-10', end: '2026-08-14' },
      existingDays: existing,
      generateId: idFactory(),
    });
    expect(toAdd.map(d => d.dateIso)).toEqual(['2026-08-13', '2026-08-14']);
    expect(toRemoveIds).toEqual([]);
  });

  test('extends backwards when the start date moves earlier', () => {
    const { toAdd } = syncItineraryDaysForRange({
      stopId: 'stop-1',
      dates: { start: '2026-08-08', end: '2026-08-12' },
      existingDays: existing,
      generateId: idFactory(),
    });
    expect(toAdd.map(d => d.dateIso)).toEqual(['2026-08-08', '2026-08-09']);
  });

  test('drops an out-of-range day only when it holds no items', () => {
    // Range shrinks to 10-10: d2 (empty) goes, d3 (1 item) stays.
    const { toAdd, toRemoveIds } = syncItineraryDaysForRange({
      stopId: 'stop-1',
      dates: { start: '2026-08-10', end: '2026-08-10' },
      existingDays: existing,
      generateId: idFactory(),
    });
    expect(toAdd).toEqual([]);
    expect(toRemoveIds).toEqual(['d2']);
  });

  test('never drops a day that still holds items, even far out of range', () => {
    const { toRemoveIds } = syncItineraryDaysForRange({
      stopId: 'stop-1',
      dates: { start: '2026-09-01', end: '2026-09-02' },
      existingDays: existing,
      generateId: idFactory(),
    });
    // d1 and d3 have items and survive; only the empty d2 is dropped.
    expect(toRemoveIds).toEqual(['d2']);
  });

  test('tolerates duplicate dates in the existing data without re-adding them', () => {
    const dupes = [day('d1', '2026-08-10'), day('d1b', '2026-08-10')];
    const { toAdd, toRemoveIds } = syncItineraryDaysForRange({
      stopId: 'stop-1',
      dates: { start: '2026-08-10', end: '2026-08-10' },
      existingDays: dupes,
      generateId: idFactory(),
    });
    expect(toAdd).toEqual([]);
    expect(toRemoveIds).toEqual([]);
  });
});
