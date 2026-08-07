jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  authReady: Promise.resolve({ uid: 'test-uid' }),
  database: require('@react-native-firebase/database').default,
}));

import { mockRef, mockOnce, mockSet, mockUpdate } from '@react-native-firebase/database';
import { addBooking, updateBooking, removeBooking } from '@/src/lib/bookingWrites';
import type { FlightBooking, HotelBooking, RentalBooking, RestaurantBooking, ItineraryItem } from '@/src/types';

beforeEach(() => {
  jest.clearAllMocks();
  (mockSet as jest.Mock).mockResolvedValue(undefined);
  (mockUpdate as jest.Mock).mockResolvedValue(undefined);
  (mockOnce as jest.Mock).mockResolvedValue({ val: () => null });
});

// ── addBooking ────────────────────────────────────────────────────────────────

describe('addBooking', () => {
  test('flight: writes a complete FlightBooking to trips/{tripId}/bookings/{newId} and resolves to that id', async () => {
    const input: Omit<FlightBooking, 'id' | 'tripId'> = {
      stopId: 'stop-1',
      type: 'flight',
      legs: [
        {
          flightNumber: 'B6 274', airline: 'JetBlue', origin: 'BOS', destination: 'PWM',
          departureDate: '2026-07-10', departureTime: '7:15 AM', arrivalTime: '8:22 AM',
        },
      ],
      confirmationCode: 'JBLMNE',
    };

    const bookingId = await addBooking('trip-1', input);

    expect(typeof bookingId).toBe('string');
    expect(bookingId.length).toBeGreaterThan(0);
    expect(mockRef).toHaveBeenCalledWith(`trips/trip-1/bookings/${bookingId}`);
    const writeArg = (mockSet as jest.Mock).mock.calls[0][0];
    expect(writeArg).toEqual({ ...input, id: bookingId, tripId: 'trip-1' });
  });

  test('hotel: writes a complete HotelBooking to trips/{tripId}/bookings/{newId} and resolves to that id', async () => {
    const input: Omit<HotelBooking, 'id' | 'tripId'> = {
      stopId: 'stop-1',
      type: 'hotel',
      hotelName: 'Press Hotel',
      checkIn: '2026-07-10',
      checkOut: '2026-07-12',
      confirmationCode: 'PHR2026',
    };

    const bookingId = await addBooking('trip-1', input);

    expect(mockRef).toHaveBeenCalledWith(`trips/trip-1/bookings/${bookingId}`);
    const writeArg = (mockSet as jest.Mock).mock.calls[0][0];
    expect(writeArg).toEqual({ ...input, id: bookingId, tripId: 'trip-1' });
  });

  test('rental: writes a complete RentalBooking to trips/{tripId}/bookings/{newId} and resolves to that id', async () => {
    const input: Omit<RentalBooking, 'id' | 'tripId'> = {
      stopId: 'stop-1',
      type: 'rental',
      company: 'Enterprise',
      carType: 'Compact SUV',
      pickupDate: '2026-07-10',
      pickupTime: '9:00 AM',
      dropoffDate: '2026-07-15',
      dropoffTime: '4:00 PM',
      pickupLocation: 'Portland Jetport',
      dropoffLocation: 'Trenton, ME',
    };

    const bookingId = await addBooking('trip-1', input);

    expect(mockRef).toHaveBeenCalledWith(`trips/trip-1/bookings/${bookingId}`);
    const writeArg = (mockSet as jest.Mock).mock.calls[0][0];
    expect(writeArg).toEqual({ ...input, id: bookingId, tripId: 'trip-1' });
  });

  test('restaurant: writes a complete RestaurantBooking to trips/{tripId}/bookings/{newId} and resolves to that id', async () => {
    const input: Omit<RestaurantBooking, 'id' | 'tripId'> = {
      stopId: 'stop-1',
      type: 'restaurant',
      restaurantName: 'Eventide Oyster Co.',
      date: '2026-07-10',
      time: '7:30 PM',
      partySize: 2,
    };

    const bookingId = await addBooking('trip-1', input);

    expect(mockRef).toHaveBeenCalledWith(`trips/trip-1/bookings/${bookingId}`);
    const writeArg = (mockSet as jest.Mock).mock.calls[0][0];
    expect(writeArg).toEqual({ ...input, id: bookingId, tripId: 'trip-1' });
  });

  test('propagates a write rejection to the caller rather than swallowing it', async () => {
    (mockSet as jest.Mock).mockRejectedValue(new Error('database/permission-denied'));
    const input: Omit<RestaurantBooking, 'id' | 'tripId'> = {
      stopId: 'stop-1', type: 'restaurant', restaurantName: 'Eventide', date: '2026-07-10',
    };
    await expect(addBooking('trip-1', input)).rejects.toThrow('database/permission-denied');
  });
});

// ── updateBooking ────────────────────────────────────────────────────────────

describe('updateBooking', () => {
  test('calls .update() (not .set()) on the correct path', async () => {
    await updateBooking('trip-1', 'booking-1', { hotelName: 'New Name' });
    expect(mockRef).toHaveBeenCalledWith('trips/trip-1/bookings/booking-1');
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockSet).not.toHaveBeenCalled();
  });

  test('writes only the patch fields, not the full booking', async () => {
    await updateBooking('trip-1', 'booking-1', { hotelName: 'New Name', roomType: 'Suite' });
    const writeArg = (mockUpdate as jest.Mock).mock.calls[0][0];
    expect(writeArg).toEqual({ hotelName: 'New Name', roomType: 'Suite' });
  });

  test('strips undefined-valued patch fields before writing', async () => {
    await updateBooking('trip-1', 'booking-1', { hotelName: 'New Name', roomType: undefined });
    const writeArg = (mockUpdate as jest.Mock).mock.calls[0][0];
    expect(writeArg).toEqual({ hotelName: 'New Name' });
    expect('roomType' in writeArg).toBe(false);
  });

  test('propagates a write rejection to the caller rather than swallowing it', async () => {
    (mockUpdate as jest.Mock).mockRejectedValue(new Error('database/permission-denied'));
    await expect(updateBooking('trip-1', 'booking-1', { hotelName: 'x' })).rejects.toThrow('database/permission-denied');
  });
});

// ── removeBooking ────────────────────────────────────────────────────────────

describe('removeBooking', () => {
  test('reads trips/{tripId}/itinerary before writing', async () => {
    await removeBooking('trip-1', 'booking-1');
    expect(mockRef).toHaveBeenCalledWith('trips/trip-1/itinerary');
    expect(mockOnce).toHaveBeenCalledWith('value');
  });

  test('issues a single root-level multi-path .update() containing the booking-null key when there are no itinerary refs', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => null });

    await removeBooking('trip-1', 'booking-1');

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const writeArg = (mockUpdate as jest.Mock).mock.calls[0][0];
    expect(writeArg).toEqual({ 'trips/trip-1/bookings/booking-1': null });
    // The update call must be issued against the root ref (no path argument).
    expect(mockRef).toHaveBeenCalledWith();
  });

  test('single root-level .update() also contains orphan-cleaned day arrays when itinerary items reference the booking', async () => {
    const matchingItem: ItineraryItem = { id: 'item-1', type: 'booking', bookingId: 'booking-1', order: 0 };
    const otherItem: ItineraryItem = { id: 'item-2', type: 'custom', label: 'Sleep in', order: 1 };
    (mockOnce as jest.Mock).mockResolvedValue({
      val: () => ({
        'stop-a': {
          'day-1': { stopId: 'stop-a', dateIso: '2026-07-10', items: [matchingItem, otherItem] },
        },
      }),
    });

    await removeBooking('trip-1', 'booking-1');

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const writeArg = (mockUpdate as jest.Mock).mock.calls[0][0];
    expect(writeArg).toEqual({
      'trips/trip-1/bookings/booking-1': null,
      'trips/trip-1/itinerary/stop-a/day-1/items': [otherItem],
    });
  });

  test('does not call .set() at all — the cascade write is a single .update() call', async () => {
    await removeBooking('trip-1', 'booking-1');
    expect(mockSet).not.toHaveBeenCalled();
  });

  test('propagates a write rejection to the caller rather than swallowing it', async () => {
    (mockUpdate as jest.Mock).mockRejectedValue(new Error('database/permission-denied'));
    await expect(removeBooking('trip-1', 'booking-1')).rejects.toThrow('database/permission-denied');
  });

  test('propagates a read rejection to the caller rather than swallowing it', async () => {
    (mockOnce as jest.Mock).mockRejectedValue(new Error('database/permission-denied'));
    await expect(removeBooking('trip-1', 'booking-1')).rejects.toThrow('database/permission-denied');
  });
});
