jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { StopSection } from '@/src/features/jernie/StopSection';
import type { StopWithColor, Booking, HotelBooking, RestaurantBooking } from '@/src/types';

const STOP: StopWithColor = {
  id: 'stop-1',
  tripId: 'trip-1',
  city: 'Portland',
  region: 'ME',
  emoji: '🦞',
  lat: 43.66,
  lon: -70.26,
  dates: { start: '2026-08-10', end: '2026-08-14' },
  order: 0,
  color: '#123456',
};

const HOTEL: HotelBooking = {
  id: 'b-hotel', tripId: 'trip-1', stopId: 'stop-1', type: 'hotel',
  hotelName: 'The Press Hotel', checkIn: '2026-08-10', checkOut: '2026-08-14',
};

const RESTAURANT: RestaurantBooking = {
  id: 'b-rest', tripId: 'trip-1', stopId: 'stop-1', type: 'restaurant',
  restaurantName: 'Fore Street', date: '2026-08-11',
};

function renderSection(
  bookings: Booking[],
  onAddBooking?: (type: string) => void,
  onAddItineraryItem?: () => void,
) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <StopSection
        stop={STOP}
        bookings={bookings}
        days={[]}
        expandedDayId={null}
        onDayPress={() => {}}
        onAddBooking={onAddBooking as ((type: never) => void) | undefined}
        onAddItineraryItem={onAddItineraryItem}
      />,
    );
  });
  return tree;
}

describe('StopSection — per-type add affordances', () => {
  test('renders no add controls when onAddBooking is omitted', () => {
    const tree = renderSection([HOTEL]);
    for (const type of ['flight', 'hotel', 'rental', 'restaurant']) {
      expect(tree.root.findAllByProps({ testID: `add-booking-${type}` })).toHaveLength(0);
    }
  });

  test('every booking type is reachable, whether or not it already has bookings', () => {
    const tree = renderSection([HOTEL], () => {});
    for (const type of ['flight', 'hotel', 'rental', 'restaurant']) {
      // findByProps returns the shallowest match and throws when there is not exactly one,
      // so this also proves no type gets a duplicate control.
      expect(() => tree.root.findByProps({ testID: `add-booking-${type}` })).not.toThrow();
    }
  });

  test('pressing a group add control passes that group\'s type', () => {
    const onAddBooking = jest.fn();
    const tree = renderSection([HOTEL, RESTAURANT], onAddBooking);

    act(() => { tree.root.findByProps({ testID: 'add-booking-hotel' }).props.onPress(); });
    expect(onAddBooking).toHaveBeenLastCalledWith('hotel');

    act(() => { tree.root.findByProps({ testID: 'add-booking-restaurant' }).props.onPress(); });
    expect(onAddBooking).toHaveBeenLastCalledWith('restaurant');

    // A type with no bookings yet still resolves to its own type, not a neighbour's.
    act(() => { tree.root.findByProps({ testID: 'add-booking-flight' }).props.onPress(); });
    expect(onAddBooking).toHaveBeenLastCalledWith('flight');
  });

  test('groups bookings under their type heading', () => {
    const tree = renderSection([HOTEL, RESTAURANT], () => {});
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Stays');
    expect(json).toContain('Restaurants');
    expect(json).toContain('The Press Hotel');
  });

  test('still renders each booking exactly once after grouping', () => {
    const tree = renderSection([HOTEL, RESTAURANT], () => {});
    const json = JSON.stringify(tree.toJSON());
    expect(json.split('The Press Hotel').length - 1).toBe(1);
  });
});

describe('StopSection — itinerary add affordance', () => {
  test('renders no itinerary add control when the callback is omitted', () => {
    const tree = renderSection([HOTEL], () => {});
    expect(tree.root.findAllByProps({ testID: 'add-itinerary-item' })).toHaveLength(0);
  });

  test('renders the control even when the stop has no itinerary days yet', () => {
    const onAddItineraryItem = jest.fn();
    const tree = renderSection([HOTEL], () => {}, onAddItineraryItem);
    act(() => { tree.root.findByProps({ testID: 'add-itinerary-item' }).props.onPress(); });
    expect(onAddItineraryItem).toHaveBeenCalledTimes(1);
  });
});
