jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  getAuthedUser: () => Promise.resolve({ uid: 'test-uid' }),
  database: require('@react-native-firebase/database').default,
}));

import { renderHook, act } from '@testing-library/react-native';
import { useAddStop } from '@/src/hooks/useAddStop';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mockRef, mockOnce, mockSet, mockUpdate } = jest.requireMock('@react-native-firebase/database');

// The stop and its generated itinerary days go out together in one root-level multi-path
// update, so assertions read the stop out of that payload rather than off a .set() call.
function stopWrite(callIndex = 0): Record<string, unknown> {
  const updates = (mockUpdate as jest.Mock).mock.calls[callIndex][0];
  const key = Object.keys(updates).find(k => /^trips\/[^/]+\/stops\/[^/]+$/.test(k))!;
  return updates[key] as Record<string, unknown>;
}

function dayWrites(callIndex = 0): Array<{ id: string; stopId: string; dateIso: string; items: unknown[] }> {
  const updates = (mockUpdate as jest.Mock).mock.calls[callIndex][0];
  return Object.entries(updates)
    .filter(([k]) => k.includes('/itinerary/'))
    .map(([, v]) => v as { id: string; stopId: string; dateIso: string; items: unknown[] });
}

const baseInput = {
  city: 'Brooklyn',
  region: 'NY',
  lat: 40.6782,
  lon: -73.9442,
  dates: { start: '2026-08-15', end: '2026-08-18' },
};

beforeEach(() => {
  jest.clearAllMocks();
  (mockSet as jest.Mock).mockResolvedValue(undefined);
  (mockUpdate as jest.Mock).mockResolvedValue(undefined);
});

describe('useAddStop', () => {
  test('reads trips/{tripId}/stops before writing the new stop', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => ({ 'stop-a': { order: 0 } }) });

    const { result } = renderHook(() => useAddStop());
    await act(async () => {
      await result.current.addStop('trip-1', baseInput);
    });

    expect(mockRef).toHaveBeenCalledWith('trips/trip-1/stops');
    expect(mockOnce).toHaveBeenCalledWith('value');
  });

  test('writes a complete Stop object to trips/{tripId}/stops/{newStopId} and resolves to that id', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => ({ 'stop-a': { order: 0 } }) });

    const { result } = renderHook(() => useAddStop());
    let stopId!: string;
    await act(async () => {
      stopId = await result.current.addStop('trip-1', baseInput);
    });

    expect(typeof stopId).toBe('string');
    expect(stopId.length).toBeGreaterThan(0);

    const updates = (mockUpdate as jest.Mock).mock.calls[0][0];
    const writeArg = updates[`trips/trip-1/stops/${stopId}`];
    expect(writeArg).toEqual({
      id: stopId,
      tripId: 'trip-1',
      city: 'Brooklyn',
      region: 'NY',
      emoji: '📍',
      lat: 40.6782,
      lon: -73.9442,
      dates: { start: '2026-08-15', end: '2026-08-18' },
      order: 1,
    });
  });

  test('order is computed from the CURRENT stop count — a trip with 1 existing stop gets order 1', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => ({ 'stop-a': { order: 0 } }) });

    const { result } = renderHook(() => useAddStop());
    await act(async () => { await result.current.addStop('trip-1', baseInput); });

    expect(stopWrite().order).toBe(1);
  });

  test('a trip with zero existing stops gets order 0', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => null });

    const { result } = renderHook(() => useAddStop());
    await act(async () => { await result.current.addStop('trip-1', baseInput); });

    expect(stopWrite().order).toBe(0);
  });

  test('order is gap-tolerant: Math.max(...orders) + 1, not currentStops.length, when orders are sparse', async () => {
    // Two existing stops with orders 0 and 2 (a gap at 1) — length-based ordering (2) would
    // collide with the existing order-2 stop; max-based ordering correctly lands on 3.
    (mockOnce as jest.Mock).mockResolvedValue({
      val: () => ({ 'stop-a': { order: 0 }, 'stop-b': { order: 2 } }),
    });

    const { result } = renderHook(() => useAddStop());
    await act(async () => { await result.current.addStop('trip-1', baseInput); });

    expect(stopWrite().order).toBe(3);
  });

  test('reads current stops fresh on every call — two sequential adds see the previous add\'s effect', async () => {
    // First call: trip has 1 existing stop (order 0) → new stop should get order 1.
    (mockOnce as jest.Mock).mockResolvedValueOnce({ val: () => ({ 'stop-a': { order: 0 } }) });
    const { result } = renderHook(() => useAddStop());
    let firstId!: string;
    await act(async () => { firstId = await result.current.addStop('trip-1', baseInput); });
    expect(stopWrite(0).order).toBe(1);

    // Second call: simulate the first stop having actually landed in RTDB now — order 2 expected.
    (mockOnce as jest.Mock).mockResolvedValueOnce({
      val: () => ({ 'stop-a': { order: 0 }, [firstId]: { order: 1 } }),
    });
    await act(async () => { await result.current.addStop('trip-1', baseInput); });
    expect(stopWrite(1).order).toBe(2);

    expect(mockOnce).toHaveBeenCalledTimes(2);
  });

  test('propagates a write rejection to the caller rather than swallowing it', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => null });
    (mockUpdate as jest.Mock).mockRejectedValue(new Error('database/permission-denied'));

    const { result } = renderHook(() => useAddStop());
    await expect(result.current.addStop('trip-1', baseInput)).rejects.toThrow('database/permission-denied');
  });

  test('carries a different input\'s city/region/lat/lon/dates through unchanged (not hardcoded)', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => null });

    const { result } = renderHook(() => useAddStop());
    await act(async () => {
      await result.current.addStop('trip-2', {
        city: 'Queens',
        region: 'NY',
        lat: 40.7282,
        lon: -73.7949,
        dates: { start: '2026-09-01', end: '2026-09-03' },
      });
    });

    expect(stopWrite()).toMatchObject({
      tripId: 'trip-2',
      city: 'Queens',
      region: 'NY',
      lat: 40.7282,
      lon: -73.7949,
      dates: { start: '2026-09-01', end: '2026-09-03' },
    });
  });
});

describe('useAddStop — itinerary day seeding', () => {
  test('writes one empty itinerary day per date in the stop range, inclusive', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => null });

    const { result } = renderHook(() => useAddStop());
    let stopId!: string;
    await act(async () => { stopId = await result.current.addStop('trip-1', baseInput); });

    // baseInput spans Aug 15–18.
    const days = dayWrites();
    expect(days.map(d => d.dateIso).sort()).toEqual(['2026-08-15', '2026-08-16', '2026-08-17', '2026-08-18']);
    expect(days.every(d => d.stopId === stopId)).toBe(true);
    expect(days.every(d => Array.isArray(d.items) && d.items.length === 0)).toBe(true);
  });

  test('the days ride in the SAME update as the stop, so a stop is never dayless', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => null });

    const { result } = renderHook(() => useAddStop());
    await act(async () => { await result.current.addStop('trip-1', baseInput); });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockRef).toHaveBeenCalledWith();
    expect(mockSet).not.toHaveBeenCalled();
  });

  test('a single-night stop still gets exactly one day', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => null });

    const { result } = renderHook(() => useAddStop());
    await act(async () => {
      await result.current.addStop('trip-1', { ...baseInput, dates: { start: '2026-08-15', end: '2026-08-15' } });
    });

    expect(dayWrites()).toHaveLength(1);
  });
});
