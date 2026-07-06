// MMKV store shared between mock and tests — allows reset in beforeEach
const _mmkvStore: Record<string, string> = {};

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => _mmkvStore[key] ?? undefined,
    set: (key: string, value: string) => { _mmkvStore[key] = value; },
    remove: (key: string) => { delete _mmkvStore[key]; },
  }),
}));

jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  authReady: Promise.resolve({ uid: 'test-uid' }),
  database: require('@react-native-firebase/database').default,
}));

import { normalizeTripSnapshot } from '@/src/hooks/useTripData';

const BASE = {
  id: 'trip-1',
  name: 'Test Trip',
  ownerUid: 'uid-1',
  createdAt: 1000000,
  pills: ['Adventure'],
  inviteToken: 'tok1',
  colorPack: { id: 'coastal', stopColors: ['#2C5880', '#1E7B8C'], heroGradient: ['#111', '#222'] },
  setupIntent: { flights: true, stays: true, car: false, restaurants: false },
  stops: {
    'stop-b': { id: 'stop-b', tripId: 'trip-1', city: 'Bar Harbor', region: 'ME', emoji: '⛵', lat: 44.38, lon: -68.20, dates: { start: '2026-07-12', end: '2026-07-15' }, order: 1 },
    'stop-a': { id: 'stop-a', tripId: 'trip-1', city: 'Portland',   region: 'ME', emoji: '🦞', lat: 43.66, lon: -70.25, dates: { start: '2026-07-10', end: '2026-07-12' }, order: 0 },
  },
  bookings: {
    'bk-1': { id: 'bk-1', tripId: 'trip-1', stopId: 'stop-a', type: 'hotel', hotelName: 'Press Hotel', checkIn: '2026-07-10', checkOut: '2026-07-12' },
    'bk-2': { id: 'bk-2', tripId: 'trip-1', stopId: 'stop-b', type: 'hotel', hotelName: 'Bar Harbor Inn', checkIn: '2026-07-12', checkOut: '2026-07-15' },
  },
  itinerary: {
    'stop-a': {
      'day-2': { id: 'day-2', stopId: 'stop-a', dateIso: '2026-07-11', items: [] },
      'day-1': { id: 'day-1', stopId: 'stop-a', dateIso: '2026-07-10', items: [] },
    },
  },
};

describe('normalizeTripSnapshot', () => {
  test('extracts trip metadata fields', () => {
    const { trip } = normalizeTripSnapshot(BASE);
    expect(trip.id).toBe('trip-1');
    expect(trip.name).toBe('Test Trip');
    expect(trip.ownerUid).toBe('uid-1');
    expect(trip.setupIntent.flights).toBe(true);
  });

  test('sorts stops by order ascending regardless of key insertion order', () => {
    const { stops } = normalizeTripSnapshot(BASE);
    expect(stops).toHaveLength(2);
    expect(stops[0].id).toBe('stop-a');   // order: 0
    expect(stops[1].id).toBe('stop-b');   // order: 1
  });

  test('derives stop color from trip.colorPack + stop.order rather than passing through raw data', () => {
    const { stops } = normalizeTripSnapshot(BASE);
    expect(stops[0].color).toBe('#2C5880');  // order 0
    expect(stops[1].color).toBe('#1E7B8C');  // order 1
  });

  test('converts bookings object to flat array', () => {
    const { bookings } = normalizeTripSnapshot(BASE);
    expect(bookings).toHaveLength(2);
    expect(bookings.map(b => b.id)).toEqual(expect.arrayContaining(['bk-1', 'bk-2']));
  });

  test('sorts itinerary days by dateIso within each stop', () => {
    const { itinerary } = normalizeTripSnapshot(BASE);
    expect(itinerary['stop-a']).toHaveLength(2);
    expect(itinerary['stop-a'][0].dateIso).toBe('2026-07-10');  // day-1 sorts first
    expect(itinerary['stop-a'][1].dateIso).toBe('2026-07-11');  // day-2 sorts second
  });

  test('handles null sub-collections without throwing', () => {
    const minimal = { ...BASE, stops: null, bookings: null, itinerary: null };
    const { stops, bookings, itinerary } = normalizeTripSnapshot(minimal as never);
    expect(stops).toEqual([]);
    expect(bookings).toEqual([]);
    expect(itinerary).toEqual({});
  });

  test('handles stops with no id field by injecting the key', () => {
    const withKeylessStop = {
      ...BASE,
      stops: {
        'stop-x': { tripId: 'trip-1', city: 'X', region: 'ME', emoji: '🏝️', lat: 0, lon: 0, dates: { start: '2026-07-10', end: '2026-07-12' }, order: 0 },
      },
    };
    const { stops } = normalizeTripSnapshot(withKeylessStop as never);
    expect(stops[0].id).toBe('stop-x');
  });
});

// ── useTripData hook-level tests ─────────────────────────────────────────────

import { renderHook, waitFor } from '@testing-library/react-native';
import { useTripData } from '@/src/hooks/useTripData';
import database, { mockOnce } from '@react-native-firebase/database';

beforeEach(() => {
  jest.clearAllMocks();
  // Reset MMKV store between tests so cached state doesn't bleed
  Object.keys(_mmkvStore).forEach(k => delete _mmkvStore[k]);
});

describe('useTripData', () => {
  test('status starts as loading', () => {
    (mockOnce as jest.Mock).mockReturnValue(new Promise(() => {}));  // never resolves
    const { result } = renderHook(() => useTripData('trip-1'));
    expect(result.current.status).toBe('loading');
    expect(result.current.trip).toBeNull();
  });

  test('status becomes ready and trip is populated after successful fetch', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => BASE });
    const { result } = renderHook(() => useTripData('trip-1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.trip?.id).toBe('trip-1');
    expect(result.current.stops).toHaveLength(2);
    expect(result.current.fromCache).toBe(false);
  });

  test('status becomes error when fetch fails, existing state is preserved', async () => {
    (mockOnce as jest.Mock).mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useTripData('trip-1'));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.trip).toBeNull();  // no cached state, stays null
  });

  test('caches trip to MMKV on successful fetch and uses it on re-mount', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => BASE });

    // First mount — fetch succeeds, writes to MMKV
    const { result: r1, unmount } = renderHook(() => useTripData('trip-1'));
    await waitFor(() => expect(r1.current.status).toBe('ready'));
    unmount();

    // Second mount — should read from MMKV immediately (fromCache: true)
    (mockOnce as jest.Mock).mockReturnValue(new Promise(() => {}));  // stall fetch
    const { result: r2 } = renderHook(() => useTripData('trip-1'));
    expect(r2.current.trip?.id).toBe('trip-1');
    expect(r2.current.fromCache).toBe(true);
  });

  test('cached trip is preserved when re-fetch fails', async () => {
    // Seed the MMKV cache directly before mounting
    const { trip } = normalizeTripSnapshot(BASE);
    _mmkvStore['trip_snapshot_trip-cached'] = JSON.stringify({
      trip, stops: [], bookings: [], itinerary: {}, cachedAt: Date.now(),
    });
    (mockOnce as jest.Mock).mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useTripData('trip-cached'));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.trip?.id).toBe('trip-1');  // cached trip must survive
  });

  test('retry re-triggers fetch', async () => {
    (mockOnce as jest.Mock).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useTripData('trip-1'));
    await waitFor(() => expect(result.current.status).toBe('error'));

    (mockOnce as jest.Mock).mockResolvedValue({ val: () => BASE });
    result.current.retry();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.trip?.id).toBe('trip-1');
  });
});
