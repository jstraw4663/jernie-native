import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { CTACardZone } from '@/src/features/jernie/CTACardZone';
import type { Trip, StopWithColor, Booking, ItineraryDay } from '@/src/types';

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    name: 'New England',
    ownerUid: 'user-1',
    createdAt: 0,
    pills: [],
    inviteToken: 'tok',
    colorPack: { id: 'pack', stopColors: ['#123456'], heroGradient: ['#111111', '#222222'] },
    setupIntent: { flights: false, stays: false, car: false, restaurants: false },
    ...overrides,
  };
}

function makeStop(overrides: Partial<StopWithColor> = {}): StopWithColor {
  return {
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
    ...overrides,
  };
}

function renderZone(ui: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(ui); });
  return tree;
}

// The two entry-point groups live in mutually exclusive phases — SETUP_ROWS in PreTripCard,
// the quick actions in InTripCard — so each needs its own `now` fixture.
function renderPreTrip(props: Partial<React.ComponentProps<typeof CTACardZone>> = {}) {
  return renderZone(
    <CTACardZone
      trip={makeTrip()}
      activeStop={makeStop()}
      bookings={[] as Booking[]}
      days={[] as ItineraryDay[]}
      now={new Date('2026-08-01T12:00:00Z')}
      isDismissed={false}
      onDismiss={() => {}}
      {...props}
    />,
  );
}

function renderInTrip(props: Partial<React.ComponentProps<typeof CTACardZone>> = {}) {
  return renderZone(
    <CTACardZone
      trip={makeTrip()}
      activeStop={makeStop()}
      bookings={[] as Booking[]}
      days={[] as ItineraryDay[]}
      now={new Date('2026-08-12T12:00:00Z')}
      isDismissed={false}
      onDismiss={() => {}}
      {...props}
    />,
  );
}

describe('CTACardZone — pre-trip setup rows', () => {
  test('renders the four setup rows as pressable entry points', () => {
    const tree = renderPreTrip({ onAddBooking: () => {} });
    for (const key of ['flights', 'stays', 'car', 'restaurants']) {
      expect(tree.root.findAllByProps({ testID: `setup-row-${key}` }).length).toBeGreaterThan(0);
    }
  });

  test('maps each row key to its booking type, not to its array position', () => {
    const onAddBooking = jest.fn();
    const tree = renderPreTrip({ onAddBooking });

    act(() => { tree.root.findByProps({ testID: 'setup-row-flights' }).props.onPress(); });
    expect(onAddBooking).toHaveBeenLastCalledWith('flight');

    act(() => { tree.root.findByProps({ testID: 'setup-row-car' }).props.onPress(); });
    expect(onAddBooking).toHaveBeenLastCalledWith('rental');

    act(() => { tree.root.findByProps({ testID: 'setup-row-stays' }).props.onPress(); });
    expect(onAddBooking).toHaveBeenLastCalledWith('hotel');

    act(() => { tree.root.findByProps({ testID: 'setup-row-restaurants' }).props.onPress(); });
    expect(onAddBooking).toHaveBeenLastCalledWith('restaurant');

    expect(onAddBooking).toHaveBeenCalledTimes(4);
  });

  test('still renders the rows when no callback is supplied', () => {
    const tree = renderPreTrip();
    expect(JSON.stringify(tree.toJSON())).toContain('Flights');
  });
});

describe('CTACardZone — in-trip quick actions', () => {
  test('"Add restaurant" calls onAddBooking with restaurant', () => {
    const onAddBooking = jest.fn();
    const tree = renderInTrip({ onAddBooking });
    act(() => { tree.root.findByProps({ testID: 'quick-action-restaurant' }).props.onPress(); });
    expect(onAddBooking).toHaveBeenCalledWith('restaurant');
  });

  test('"Log activity" calls onLogActivity', () => {
    const onLogActivity = jest.fn();
    const tree = renderInTrip({ onLogActivity });
    act(() => { tree.root.findByProps({ testID: 'quick-action-log-activity' }).props.onPress(); });
    expect(onLogActivity).toHaveBeenCalledTimes(1);
  });

  test('the pre-trip setup rows are not rendered during the trip', () => {
    const tree = renderInTrip({ onAddBooking: () => {} });
    expect(tree.root.findAllByProps({ testID: 'setup-row-flights' })).toHaveLength(0);
  });
});
