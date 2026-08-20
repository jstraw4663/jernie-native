jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  getAuthedUser: () => Promise.resolve({ uid: 'test-uid' }),
  database: require('@react-native-firebase/database').default,
}));

import { mockRef, mockOnce, mockSet, mockUpdate } from '@react-native-firebase/database';
import { updateStop, removeStop } from '@/src/lib/stopWrites';
import type { Booking, ItineraryItem, Place, RentalBooking } from '@/src/types';

beforeEach(() => {
  jest.clearAllMocks();
  (mockSet as jest.Mock).mockResolvedValue(undefined);
  (mockUpdate as jest.Mock).mockResolvedValue(undefined);
  (mockOnce as jest.Mock).mockResolvedValue({ val: () => null });
});

// ── updateStop ───────────────────────────────────────────────────────────────

describe('updateStop', () => {
  test('calls .update() (not .set()) on trips/{tripId}/stops/{stopId}', async () => {
    await updateStop('trip-1', 'stop-1', { city: 'Bar Harbor' });
    expect(mockRef).toHaveBeenCalledWith('trips/trip-1/stops/stop-1');
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockSet).not.toHaveBeenCalled();
  });

  test('writes only the patch fields, not the full stop', async () => {
    await updateStop('trip-1', 'stop-1', { city: 'Bar Harbor', emoji: '🦞' });
    const writeArg = (mockUpdate as jest.Mock).mock.calls[0][0];
    expect(writeArg).toEqual({ city: 'Bar Harbor', emoji: '🦞' });
  });

  test('strips undefined-valued patch fields before writing', async () => {
    await updateStop('trip-1', 'stop-1', { city: 'Bar Harbor', region: undefined });
    const writeArg = (mockUpdate as jest.Mock).mock.calls[0][0];
    expect(writeArg).toEqual({ city: 'Bar Harbor' });
    expect('region' in writeArg).toBe(false);
  });

  test('propagates a write rejection to the caller rather than swallowing it', async () => {
    (mockUpdate as jest.Mock).mockRejectedValue(new Error('database/permission-denied'));
    await expect(updateStop('trip-1', 'stop-1', { city: 'x' })).rejects.toThrow('database/permission-denied');
  });
});

// ── removeStop ───────────────────────────────────────────────────────────────

describe('removeStop', () => {
  test('reads bookings, itinerary, and places (all three paths) before writing', async () => {
    await removeStop('trip-1', 'stop-remove');
    expect(mockRef).toHaveBeenCalledWith('trips/trip-1/bookings');
    expect(mockRef).toHaveBeenCalledWith('trips/trip-1/itinerary');
    expect(mockRef).toHaveBeenCalledWith('trips/trip-1/places');
    expect(mockOnce).toHaveBeenCalledWith('value');
  });

  test('issues a single root-level multi-path .update() containing just the two base deletion keys when there is nothing else to cascade', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => null });

    await removeStop('trip-1', 'stop-remove');

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const writeArg = (mockUpdate as jest.Mock).mock.calls[0][0];
    expect(writeArg).toEqual({
      'trips/trip-1/stops/stop-remove': null,
      'trips/trip-1/itinerary/stop-remove': null,
    });
    // The update call must be issued against the root ref (no path argument).
    expect(mockRef).toHaveBeenCalledWith();
  });

  test('single root-level .update() matches buildStopRemovalUpdates output for a realistic multi-collection fixture', async () => {
    const rentalHere: RentalBooking = {
      id: 'booking-r1', tripId: 'trip-1', stopId: 'stop-remove', type: 'rental', company: 'Enterprise',
      pickupDate: '2026-07-10', dropoffDate: '2026-07-15', pickupLocation: 'Portland Jetport', dropoffLocation: 'Bar Harbor',
      dropoffStopId: 'stop-b',
    };
    const restaurantElsewhere: Booking = {
      id: 'booking-x', tripId: 'trip-1', stopId: 'stop-b', type: 'restaurant', restaurantName: 'Fore Street', date: '2026-07-11',
    };
    const placeHere: Place = {
      id: 'place-1', tripId: 'trip-1', stopId: 'stop-remove', name: 'Duckfat', category: 'restaurant', must: true, source: 'curator', addedBy: 'uid-1',
    };
    const dropoffItem: ItineraryItem = { id: 'item-1', type: 'booking', bookingId: 'booking-r1', order: 0 };
    const keepItem: ItineraryItem = { id: 'item-2', type: 'custom', label: 'Explore downtown', order: 1 };

    // removeStop reads bookings, then itinerary, then places (Promise.all evaluates its array
    // elements synchronously in source order), so mockOnce resolves in that same order here.
    (mockOnce as jest.Mock)
      .mockResolvedValueOnce({ val: () => ({ 'booking-r1': rentalHere, 'booking-x': restaurantElsewhere }) })
      .mockResolvedValueOnce({
        val: () => ({
          'stop-b': { 'day-1': { stopId: 'stop-b', dateIso: '2026-07-11', items: [dropoffItem, keepItem] } },
        }),
      })
      .mockResolvedValueOnce({ val: () => ({ 'place-1': placeHere }) });

    await removeStop('trip-1', 'stop-remove');

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const writeArg = (mockUpdate as jest.Mock).mock.calls[0][0];
    expect(writeArg).toEqual({
      'trips/trip-1/stops/stop-remove': null,
      'trips/trip-1/itinerary/stop-remove': null,
      'trips/trip-1/bookings/booking-r1': null,
      'trips/trip-1/places/place-1': null,
      'trips/trip-1/itinerary/stop-b/day-1/items': [keepItem],
    });
  });

  test('does not call .set() at all — the cascade write is a single .update() call', async () => {
    await removeStop('trip-1', 'stop-remove');
    expect(mockSet).not.toHaveBeenCalled();
  });

  test('propagates a write rejection to the caller rather than swallowing it', async () => {
    (mockUpdate as jest.Mock).mockRejectedValue(new Error('database/permission-denied'));
    await expect(removeStop('trip-1', 'stop-remove')).rejects.toThrow('database/permission-denied');
  });

  test('propagates a read rejection to the caller rather than swallowing it', async () => {
    (mockOnce as jest.Mock).mockRejectedValue(new Error('database/permission-denied'));
    await expect(removeStop('trip-1', 'stop-remove')).rejects.toThrow('database/permission-denied');
  });
});

// ── updateStop — itinerary day sync ──────────────────────────────────────────

describe('updateStop — keeps itinerary days in step with the stop dates', () => {
  test('a patch without dates never reads or touches the itinerary', async () => {
    await updateStop('trip-1', 'stop-1', { city: 'Bar Harbor' });
    expect(mockRef).not.toHaveBeenCalledWith('trips/trip-1/itinerary/stop-1');
    expect(mockOnce).not.toHaveBeenCalled();
  });

  test('widening the range adds the missing days alongside the stop patch, atomically', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({
      val: () => ({
        d1: { id: 'd1', stopId: 'stop-1', dateIso: '2026-08-10', items: [] },
        d2: { id: 'd2', stopId: 'stop-1', dateIso: '2026-08-11', items: [] },
      }),
    });

    await updateStop('trip-1', 'stop-1', { dates: { start: '2026-08-10', end: '2026-08-13' } });

    expect(mockRef).toHaveBeenCalledWith('trips/trip-1/itinerary/stop-1');
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updates = (mockUpdate as jest.Mock).mock.calls[0][0];

    expect(updates['trips/trip-1/stops/stop-1/dates']).toEqual({ start: '2026-08-10', end: '2026-08-13' });
    const added = Object.entries(updates)
      .filter(([k]) => k.startsWith('trips/trip-1/itinerary/stop-1/'))
      .map(([, v]) => (v as { dateIso: string }).dateIso);
    expect(added.sort()).toEqual(['2026-08-12', '2026-08-13']);
  });

  test('shortening the range deletes the now-empty out-of-range day', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({
      val: () => ({
        d1: { id: 'd1', stopId: 'stop-1', dateIso: '2026-08-10', items: [] },
        d2: { id: 'd2', stopId: 'stop-1', dateIso: '2026-08-11', items: [] },
      }),
    });

    await updateStop('trip-1', 'stop-1', { dates: { start: '2026-08-10', end: '2026-08-10' } });

    const updates = (mockUpdate as jest.Mock).mock.calls[0][0];
    expect(updates['trips/trip-1/itinerary/stop-1/d2']).toBeNull();
  });

  test('keeps an out-of-range day that still holds items, so nothing entered is destroyed', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({
      val: () => ({
        d1: { id: 'd1', stopId: 'stop-1', dateIso: '2026-08-10', items: [] },
        d2: { id: 'd2', stopId: 'stop-1', dateIso: '2026-08-11', items: [{ id: 'i1', type: 'custom', label: 'Dinner', order: 0 }] },
      }),
    });

    await updateStop('trip-1', 'stop-1', { dates: { start: '2026-08-10', end: '2026-08-10' } });

    const updates = (mockUpdate as jest.Mock).mock.calls[0][0];
    expect('trips/trip-1/itinerary/stop-1/d2' in updates).toBe(false);
  });

  test('a stop with no itinerary yet gets a full set of days', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => null });

    await updateStop('trip-1', 'stop-1', { dates: { start: '2026-08-10', end: '2026-08-11' } });

    const updates = (mockUpdate as jest.Mock).mock.calls[0][0];
    const dayKeys = Object.keys(updates).filter(k => k.startsWith('trips/trip-1/itinerary/stop-1/'));
    expect(dayKeys).toHaveLength(2);
  });

  test('carries the other patched fields through the same update', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => null });

    await updateStop('trip-1', 'stop-1', { city: 'Bar Harbor', dates: { start: '2026-08-10', end: '2026-08-10' } });

    const updates = (mockUpdate as jest.Mock).mock.calls[0][0];
    expect(updates['trips/trip-1/stops/stop-1/city']).toBe('Bar Harbor');
  });
});
