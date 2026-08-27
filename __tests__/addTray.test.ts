// The tray is MMKV-backed so a half-built batch survives an app kill mid-add. Mocked here
// the same way writeQueue's tests mock it, so this runs in Node without a native module.
const store: Record<string, string> = {};
jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn().mockReturnValue({
    getString: (key: string) => store[key] ?? null,
    set: (key: string, value: string) => { store[key] = value; },
    delete: (key: string) => { delete store[key]; },
  }),
}));

import {
  getTray, addToTray, removeFromTray, clearTray, subscribe, TRAY_STORAGE_KEY, TRAY_VERSION,
} from '@/src/lib/addTray';
import type { Candidate } from '@/src/domain/candidate';

const TRIP = 'trip-maine';

function makeCandidate(id: string, overrides: Partial<Candidate> = {}): Candidate {
  return {
    id,
    type: 'eat',
    typeConfidence: 'explicit',
    identity: { name: "Thurston's Lobster Pound", subtitle: 'Seafood · Bernard, ME', icon: 'fork-knife' },
    fields: [],
    commit: {
      target: 'custom',
      item: { stopId: 'stop-bar-harbor', dateIso: '2026-09-27', label: "Thurston's", category: 'restaurant' },
    },
    ...overrides,
  };
}

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
});

describe('the add tray', () => {
  test('starts empty', () => {
    expect(getTray(TRIP)).toEqual([]);
  });

  test('holds what is added, in the order it was added', () => {
    addToTray(TRIP, makeCandidate('a'));
    addToTray(TRIP, makeCandidate('b'));

    expect(getTray(TRIP).map(c => c.id)).toEqual(['a', 'b']);
  });

  // The entire reason this is MMKV-backed rather than component state: "Add 3 items" is a
  // batch a traveller builds over minutes, and losing it to a backgrounded app that got
  // reaped is the failure the design is trying to avoid.
  test('survives the module being torn down and reloaded', () => {
    addToTray(TRIP, makeCandidate('a'));

    let reloaded: typeof import('@/src/lib/addTray');
    jest.isolateModules(() => { reloaded = require('@/src/lib/addTray'); });

    expect(reloaded!.getTray(TRIP).map(c => c.id)).toEqual(['a']);
  });

  test('removes one entry by id and leaves the rest', () => {
    addToTray(TRIP, makeCandidate('a'));
    addToTray(TRIP, makeCandidate('b'));

    removeFromTray(TRIP, 'a');

    expect(getTray(TRIP).map(c => c.id)).toEqual(['b']);
  });

  test('clears the whole tray, which is what a successful commit does', () => {
    addToTray(TRIP, makeCandidate('a'));
    addToTray(TRIP, makeCandidate('b'));

    clearTray(TRIP);

    expect(getTray(TRIP)).toEqual([]);
  });

  // Re-adding the same id replaces rather than duplicating. Ids are generated per built
  // candidate so a collision should not arise, but a double-tap must not put two of the
  // same place in a batch that then writes both.
  test('adding the same id twice replaces rather than duplicating', () => {
    addToTray(TRIP, makeCandidate('a'));
    addToTray(TRIP, makeCandidate('a', { identity: { name: 'Renamed', subtitle: '', icon: 'x' } }));

    const tray = getTray(TRIP);
    expect(tray).toHaveLength(1);
    expect(tray[0].identity.name).toBe('Renamed');
  });
});

// A tray belongs to a trip. An app killed mid-add can reopen on a different trip, and
// showing one trip's pending items on another — or worse, committing them there — would
// write a booking into the wrong holiday.
describe('the add tray — trip scoping', () => {
  test('keeps each trip’s tray separate', () => {
    addToTray(TRIP, makeCandidate('a'));
    addToTray('trip-other', makeCandidate('b'));

    expect(getTray(TRIP).map(c => c.id)).toEqual(['a']);
    expect(getTray('trip-other').map(c => c.id)).toEqual(['b']);
  });

  test('clearing one trip leaves the other alone', () => {
    addToTray(TRIP, makeCandidate('a'));
    addToTray('trip-other', makeCandidate('b'));

    clearTray(TRIP);

    expect(getTray(TRIP)).toEqual([]);
    expect(getTray('trip-other').map(c => c.id)).toEqual(['b']);
  });
});

describe('the add tray — subscribers', () => {
  test('notifies on add, remove and clear', () => {
    const seen: number[] = [];
    const unsubscribe = subscribe(() => seen.push(getTray(TRIP).length));

    addToTray(TRIP, makeCandidate('a'));
    addToTray(TRIP, makeCandidate('b'));
    removeFromTray(TRIP, 'a');
    clearTray(TRIP);

    expect(seen).toEqual([1, 2, 1, 0]);
    unsubscribe();
  });

  test('stops notifying once unsubscribed', () => {
    const fn = jest.fn();
    subscribe(fn)();

    addToTray(TRIP, makeCandidate('a'));

    expect(fn).not.toHaveBeenCalled();
  });
});

// A persisted tray outlives an app update, which an in-memory one never could. Each
// candidate carries a `commit` payload that goes straight into an RTDB multi-path update,
// so a stale shape from an older build is not a rendering glitch — it is a malformed write.
describe('the add tray — surviving bad or stale storage', () => {
  test('unparseable storage reads as empty rather than throwing', () => {
    store[TRAY_STORAGE_KEY] = '{ not json';

    expect(() => getTray(TRIP)).not.toThrow();
    expect(getTray(TRIP)).toEqual([]);
  });

  test('a tray written by an older version is dropped, not committed', () => {
    store[TRAY_STORAGE_KEY] = JSON.stringify({
      version: TRAY_VERSION - 1,
      trays: { [TRIP]: [makeCandidate('stale')] },
    });

    expect(getTray(TRIP)).toEqual([]);
  });

  test('a payload of the right version but the wrong shape reads as empty', () => {
    store[TRAY_STORAGE_KEY] = JSON.stringify({ version: TRAY_VERSION, trays: 'not-an-object' });

    expect(getTray(TRIP)).toEqual([]);
  });

  test('writing after a dropped read leaves valid storage behind', () => {
    store[TRAY_STORAGE_KEY] = '{ not json';

    addToTray(TRIP, makeCandidate('a'));

    expect(getTray(TRIP).map(c => c.id)).toEqual(['a']);
    expect(JSON.parse(store[TRAY_STORAGE_KEY]).version).toBe(TRAY_VERSION);
  });
});
