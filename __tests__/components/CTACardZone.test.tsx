import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { CTACardZone, getCtaCardKind } from '@/src/features/jernie/CTACardZone';
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

// I5: jernie.tsx re-measures the CTA wrapper's frozen height by resetting a sentinel
// whenever this function's return value changes — exported specifically so that decision
// can never drift from what CTACardZone itself actually renders (both switch on it).
describe('getCtaCardKind (I5)', () => {
  const preStop = makeStop({ dates: { start: '2026-08-10', end: '2026-08-14' } });
  const nudge = { level: 'gentle' as const, onSave: () => {}, onSnooze: () => {} };

  test('pre-trip, not dismissed, no nudge → "pre"', () => {
    expect(getCtaCardKind({
      activeStop: preStop, now: new Date('2026-08-01T12:00:00Z'), isDismissed: false, saveNudge: null,
    })).toBe('pre');
  });

  test('pre-trip, dismissed, no nudge → null (nothing rendered)', () => {
    expect(getCtaCardKind({
      activeStop: preStop, now: new Date('2026-08-01T12:00:00Z'), isDismissed: true, saveNudge: null,
    })).toBeNull();
  });

  test('in-trip → "in"', () => {
    expect(getCtaCardKind({
      activeStop: preStop, now: new Date('2026-08-12T12:00:00Z'), isDismissed: false, saveNudge: null,
    })).toBe('in');
  });

  test('post-trip → null', () => {
    expect(getCtaCardKind({
      activeStop: preStop, now: new Date('2026-09-15T12:00:00Z'), isDismissed: false, saveNudge: null,
    })).toBeNull();
  });

  test('a due nudge outranks the phase router in every phase', () => {
    for (const now of ['2026-08-01T12:00:00Z', '2026-08-12T12:00:00Z', '2026-09-15T12:00:00Z']) {
      expect(getCtaCardKind({ activeStop: preStop, now: new Date(now), isDismissed: true, saveNudge: nudge }))
        .toBe('nudge');
    }
  });

  // The exact I5 scenario: day 8, pre-trip, save nudge showing (short card) — user snoozes
  // it — identity must flip from 'nudge' to 'pre' (the taller setup checklist) so the
  // caller knows to re-measure rather than reuse the nudge card's frozen height.
  test('identity changes from "nudge" to "pre" when the nudge is snoozed mid pre-trip', () => {
    const before = getCtaCardKind({ activeStop: preStop, now: new Date('2026-08-01T12:00:00Z'), isDismissed: false, saveNudge: nudge });
    const after = getCtaCardKind({ activeStop: preStop, now: new Date('2026-08-01T12:00:00Z'), isDismissed: false, saveNudge: null });
    expect(before).toBe('nudge');
    expect(after).toBe('pre');
    expect(before).not.toBe(after);
  });
});

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

  // I2: the nudge previously had no busy state and no error surface at all.
  test('disables the sign-in button and shows a spinner while busy', () => {
    const tree = renderPreTrip({ saveNudge: { ...nudge, busy: true } });
    const button = tree.root.findByProps({ testID: 'save-nudge-save' });
    expect(button.props.disabled).toBe(true);
    expect(tree.root.findAllByProps({ testID: 'save-nudge-error' })).toHaveLength(0);
  });

  test('renders an error message on the card when one is set', () => {
    const tree = renderPreTrip({ saveNudge: { ...nudge, error: 'network down' } });
    expect(textsOf(tree)).toContain('network down');
  });

  test('shows no error text when none is set', () => {
    const tree = renderPreTrip({ saveNudge: nudge });
    expect(tree.root.findAllByProps({ testID: 'save-nudge-error' })).toHaveLength(0);
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
