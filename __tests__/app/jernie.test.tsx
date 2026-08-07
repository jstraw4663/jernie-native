jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@gorhom/bottom-sheet', () => {
  const RN = require('react-native');
  const ReactLib = require('react');
  const MockBottomSheetModal = ReactLib.forwardRef((props: { children?: React.ReactNode }, ref: React.Ref<unknown>) => {
    ReactLib.useImperativeHandle(ref, () => ({ present: () => {}, dismiss: () => {} }));
    return ReactLib.createElement(RN.View, null, props.children);
  });
  return {
    BottomSheetScrollView: RN.ScrollView,
    BottomSheetModal: MockBottomSheetModal,
    BottomSheetBackdrop: RN.View,
    useBottomSheetSpringConfigs: () => ({}),
  };
});
jest.mock('@/src/contexts/SheetContext', () => ({
  useSheetContext: () => ({ increment: jest.fn(), decrement: jest.fn() }),
}));
jest.mock('react-native-calendars', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return { Calendar: (props: Record<string, unknown>) => ReactActual.createElement(View, props) };
});
// Single choke point for every write path the screen's sheets pull in.
jest.mock('@/src/lib/firebase', () => ({
  authReady: Promise.resolve({ uid: 'uid-1' }),
  auth: () => ({}),
  database: () => ({ ref: () => ({ set: jest.fn(), update: jest.fn(), once: jest.fn() }) }),
  firestore: () => ({}),
}));
// Pinned so the trip's phase (and therefore which CTA card renders) is deterministic.
jest.mock('@/src/utils/devTime', () => ({
  getDevNow: () => new Date('2026-08-01T12:00:00'),
}));

let mockContextValue: Record<string, unknown>;
jest.mock('@/src/contexts/TripContext', () => ({
  useTripContext: () => mockContextValue,
}));

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import JernieTab from '@/app/(trips)/[tripId]/(tabs)/jernie';
import { CTACardZone } from '@/src/features/jernie/CTACardZone';
import { SampleCTACarousel } from '@/src/features/jernie/SampleCTACarousel';
import { ItineraryDayRow } from '@/src/features/jernie/components/ItineraryDayRow';
import type { Trip, StopWithColor } from '@/src/types';

const TRIP: Trip = {
  id: 'trip-1',
  name: 'New England',
  ownerUid: 'uid-1',
  createdAt: 0,
  pills: [],
  inviteToken: 'tok',
  colorPack: { id: 'pack', stopColors: ['#2C5880', '#1E7B8C'], heroGradient: ['#111111', '#222222'] },
  setupIntent: { flights: false, stays: false, car: false, restaurants: false },
};

const STOP_A: StopWithColor = { id: 'stop-a', tripId: 'trip-1', city: 'Portland', region: 'ME', emoji: '🦞', lat: 0, lon: 0, dates: { start: '2026-08-10', end: '2026-08-14' }, order: 0, color: '#2C5880' };
const STOP_B: StopWithColor = { id: 'stop-b', tripId: 'trip-1', city: 'Bar Harbor', region: 'ME', emoji: '⛵', lat: 0, lon: 0, dates: { start: '2026-08-15', end: '2026-08-18' }, order: 1, color: '#1E7B8C' };

// The screen passes a RefreshControl *element* as a prop, so the rendered tree can't be
// JSON.stringify'd (circular fiber refs) — read the visible text instead.
function texts(tree: renderer.ReactTestRenderer): string {
  return tree.root.findAllByType(Text).map(t => {
    const c = t.props.children;
    return Array.isArray(c) ? c.join('') : String(c);
  }).join(' | ');
}

function renderScreen() {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<JernieTab />); });
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockContextValue = {
    trip: TRIP,
    stops: [STOP_A, STOP_B],
    bookings: [],
    itinerary: {},
    places: [],
    enrichment: {},
    status: 'ready',
    refetch: jest.fn(),
  };
});

describe('JernieTab — CTA zone', () => {
  test('renders the real, data-driven CTA card rather than the hardcoded mock carousel', () => {
    const tree = renderScreen();
    const t = texts(tree);
    // The real card is driven by trip.setupIntent and carries pressable setup rows.
    expect(tree.root.findAllByProps({ testID: 'setup-row-flights' }).length).toBeGreaterThan(0);
    expect(t).toContain('New England');
    // Text unique to SampleCTACarousel's fixed mock cards must be gone.
    expect(t).not.toContain('Dinner Reservation');
  });

  test('mounts CTACardZone and not the mock carousel that owned the stray dots', () => {
    const tree = renderScreen();
    // The dots were SampleCTACarousel's own page indicator over 5 hardcoded cards —
    // unmounting the carousel is what removes them.
    expect(tree.root.findAllByType(SampleCTACarousel)).toHaveLength(0);
    expect(tree.root.findAllByType(CTACardZone)).toHaveLength(1);
  });

  test('a setup row opens the booking form for that type', () => {
    const tree = renderScreen();
    act(() => { tree.root.findByProps({ testID: 'setup-row-flights' }).props.onPress(); });
    // The booking sheet is now presenting a flight form.
    expect(tree.root.findAllByProps({ testID: 'booking-form-leg-0-airline' }).length).toBeGreaterThan(0);
  });

  test('dismissing the pre-trip card hides it', () => {
    const tree = renderScreen();
    expect(tree.root.findAllByProps({ testID: 'cta-dismiss' }).length).toBeGreaterThan(0);
    act(() => { tree.root.findByProps({ testID: 'cta-dismiss' }).props.onPress(); });
    expect(tree.root.findAllByProps({ testID: 'setup-row-flights' })).toHaveLength(0);
  });
});

describe('JernieTab — itinerary day auto-expansion', () => {
  const DAYS_A = [
    { id: 'a1', stopId: 'stop-a', dateIso: '2026-08-10', items: [] },
    { id: 'a2', stopId: 'stop-a', dateIso: '2026-08-11', items: [] },
  ];
  const DAYS_B = [
    { id: 'b1', stopId: 'stop-b', dateIso: '2026-08-15', items: [] },
    { id: 'b2', stopId: 'stop-b', dateIso: '2026-08-16', items: [] },
  ];

  // ItineraryDayRow always renders its items and only animates height, so expansion has to
  // be read off the prop rather than inferred from whether item text is present.
  function expandedIds(tree: renderer.ReactTestRenderer): string[] {
    return tree.root.findAllByType(ItineraryDayRow)
      .filter(r => r.props.isExpanded)
      .map(r => r.props.day.id);
  }

  test('auto-expands the first day of every stop present at mount', () => {
    mockContextValue.itinerary = { 'stop-a': DAYS_A, 'stop-b': DAYS_B };
    const tree = renderScreen();
    // now = Aug 1, before both stops, so each opens its Day 1.
    expect(expandedIds(tree).sort()).toEqual(['a1', 'b1']);
  });

  test('auto-expands for a stop that only appears after a refetch', () => {
    mockContextValue = { ...mockContextValue, stops: [STOP_A], itinerary: { 'stop-a': DAYS_A } };
    const tree = renderScreen();
    expect(expandedIds(tree)).toEqual(['a1']);

    // A stop added mid-session arrives through a refetch — the case a useState
    // initializer misses, leaving the new stop permanently collapsed.
    mockContextValue = {
      ...mockContextValue,
      stops: [STOP_A, STOP_B],
      itinerary: { 'stop-a': DAYS_A, 'stop-b': DAYS_B },
    };
    act(() => { tree.update(<JernieTab />); });

    expect(expandedIds(tree).sort()).toEqual(['a1', 'b1']);
  });

  test('days that arrive for an existing stop after a refetch get expanded too', () => {
    mockContextValue = { ...mockContextValue, stops: [STOP_A], itinerary: {} };
    const tree = renderScreen();
    expect(expandedIds(tree)).toEqual([]);

    mockContextValue = { ...mockContextValue, itinerary: { 'stop-a': DAYS_A } };
    act(() => { tree.update(<JernieTab />); });

    expect(expandedIds(tree)).toEqual(['a1']);
  });

  test('collapsing a day is respected and does not snap back open', () => {
    mockContextValue = { ...mockContextValue, stops: [STOP_A], itinerary: { 'stop-a': DAYS_A } };
    const tree = renderScreen();
    expect(expandedIds(tree)).toEqual(['a1']);

    act(() => { tree.root.findByProps({ testID: 'itinerary-day-a1' }).props.onPress(); });
    expect(expandedIds(tree)).toEqual([]);
  });

  test('expanding a different day replaces the auto-expanded one', () => {
    mockContextValue = { ...mockContextValue, stops: [STOP_A], itinerary: { 'stop-a': DAYS_A } };
    const tree = renderScreen();

    act(() => { tree.root.findByProps({ testID: 'itinerary-day-a2' }).props.onPress(); });
    expect(expandedIds(tree)).toEqual(['a2']);
  });
});
