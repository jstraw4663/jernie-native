jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  authReady: Promise.resolve({ uid: 'test-uid' }),
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
