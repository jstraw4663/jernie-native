import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
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

function textsOf(tree: renderer.ReactTestRenderer): string {
  return tree.root.findAllByType(Text).map(t => {
    const c = t.props.children;
    return Array.isArray(c) ? c.join('') : String(c);
  }).join(' | ');
}

// The zone takes `now` as a prop, so every phase is reachable by moving the clock past
// the stop's dates (makeStop ends 2026-08-14).
function renderPostTrip(props: Partial<React.ComponentProps<typeof CTACardZone>> = {}) {
  return renderZone(
    <CTACardZone
      trip={makeTrip()}
      activeStop={makeStop()}
      bookings={[] as Booking[]}
      days={[] as ItineraryDay[]}
      now={new Date('2026-09-15T12:00:00Z')}
      isDismissed={false}
      onDismiss={() => {}}
      {...props}
    />,
  );
}

describe('CTACardZone save nudge', () => {
  let nudge: { level: 'gentle' | 'firm'; onSave: jest.Mock; onSnooze: jest.Mock };
  beforeEach(() => {
    nudge = { level: 'gentle', onSave: jest.fn(), onSnooze: jest.fn() };
  });

  test('renders the save card when a nudge is due', () => {
    const tree = renderPreTrip({ saveNudge: nudge });
    expect(tree.root.findAllByProps({ testID: 'save-nudge-card' }).length).toBeGreaterThan(0);
  });

  // The nudge outranks the phase router: an unsaved trip needs nudging in every phase,
  // and the router returns null for 'post' and for a dismissed 'pre'.
  test('shows in the post-trip phase, where the phase router renders nothing', () => {
    const tree = renderPostTrip({ saveNudge: nudge });
    expect(tree.root.findAllByProps({ testID: 'save-nudge-card' }).length).toBeGreaterThan(0);
  });

  test('shows even when the setup card has been dismissed', () => {
    const tree = renderPreTrip({ isDismissed: true, saveNudge: nudge });
    expect(tree.root.findAllByProps({ testID: 'save-nudge-card' }).length).toBeGreaterThan(0);
  });

  test('leaves the normal setup card alone when no nudge is due', () => {
    const tree = renderPreTrip({ saveNudge: null });
    expect(tree.root.findAllByProps({ testID: 'save-nudge-card' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: 'setup-row-flights' }).length).toBeGreaterThan(0);
  });

  test('suppresses the in-trip quick actions while a nudge is showing', () => {
    const tree = renderInTrip({ saveNudge: nudge });
    expect(tree.root.findAllByProps({ testID: 'save-nudge-card' }).length).toBeGreaterThan(0);
  });

  test('fires onSnooze when dismissed', () => {
    const tree = renderPreTrip({ saveNudge: nudge });
    act(() => { tree.root.findByProps({ testID: 'save-nudge-dismiss' }).props.onPress(); });
    expect(nudge.onSnooze).toHaveBeenCalled();
  });

  test('fires onSave when the sign-in button is pressed', () => {
    const tree = renderPreTrip({ saveNudge: nudge });
    act(() => { tree.root.findByProps({ testID: 'save-nudge-save' }).props.onPress(); });
    expect(nudge.onSave).toHaveBeenCalled();
  });

  test('uses firmer copy at the firm level', () => {
    const gentle = textsOf(renderPreTrip({ saveNudge: nudge }));
    const firm = textsOf(renderPreTrip({ saveNudge: { ...nudge, level: 'firm' } }));
    expect(firm).not.toBe(gentle);
  });
});

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
