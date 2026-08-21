jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});
// jernie.tsx pulls in nudgeSnooze.ts (createMMKV at module-eval time) even though useAuth
// is mocked below — same mock shape as __tests__/nudgeSnooze.test.ts.
// Stateful (not just a no-op stub): the save-nudge snooze tests need a write from onSnooze
// to actually be observable on the next readSnooze() call.
const mockMMKVStore: Record<string, string> = {};
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => mockMMKVStore[key],
    set: (key: string, value: string) => { mockMMKVStore[key] = value; },
    remove: (key: string) => { delete mockMMKVStore[key]; },
  }),
}));
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
  getAuthedUser: () => Promise.resolve({ uid: 'uid-1' }),
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
// Default: authenticated with no anonCreatedAt so shouldShowNudge returns null — most
// tests in this file don't care about the save nudge. The "JernieTab — save nudge" describe
// block below overrides this per test.
let mockAuthState: Record<string, unknown>;
jest.mock('@/src/contexts/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

// The save nudge's collision-handling path (same as Profile's and step 3's).
let mockUserTripsState: { trips: unknown[]; status: 'loading' | 'ready' | 'error' };
jest.mock('@/src/hooks/useUserTrips', () => ({
  useUserTrips: () => mockUserTripsState,
}));
const mockConfirmAdopt = jest.fn();
jest.mock('@/src/lib/collisionPrompt', () => ({
  confirmAdoptExistingAccount: (...a: unknown[]) => mockConfirmAdopt(...a),
}));

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import JernieTab from '@/app/(trips)/[tripId]/(tabs)/jernie';
import { CTACardZone } from '@/src/features/jernie/CTACardZone';
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
  Object.keys(mockMMKVStore).forEach(k => delete mockMMKVStore[k]);
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
  mockAuthState = { status: 'authenticated', user: { uid: 'u' }, anonCreatedAt: null, signInWithApple: jest.fn() };
  mockUserTripsState = { trips: [], status: 'ready' };
});

describe('JernieTab — CTA zone', () => {
  test('renders the real, data-driven CTA card rather than the hardcoded mock carousel', () => {
    const tree = renderScreen();
    const t = texts(tree);
    // The real card is driven by trip.setupIntent and carries pressable setup rows.
    expect(tree.root.findAllByProps({ testID: 'setup-row-flights' }).length).toBeGreaterThan(0);
    expect(t).toContain('New England');
    // Text unique to the deleted mock carousel's fixed cards must never come back.
    expect(t).not.toContain('Dinner Reservation');
  });

  test('mounts exactly one CTACardZone', () => {
    const tree = renderScreen();
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

// I2: the nudge card's onSave previously did a bare `void signInWithApple()` — no busy
// state, no error, no collision handling. This block exercises the real four-branch
// handleSaveNudge, which the old permanently-authenticated mock made impossible to reach.
describe('JernieTab — save nudge', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const eightDaysAgo = () => Date.now() - 8 * DAY;

  test('shows the save nudge card, outranking the phase router, when a nudge is due', () => {
    mockAuthState = {
      status: 'anonymous', user: { uid: 'u' }, anonCreatedAt: eightDaysAgo(), signInWithApple: jest.fn(),
    };
    const tree = renderScreen();
    expect(tree.root.findAllByProps({ testID: 'save-nudge-card' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: 'setup-row-flights' })).toHaveLength(0);
  });

  test('a successful save is reflected once status flips (the C1 fix) and the card disappears', async () => {
    const signInWithApple = jest.fn().mockResolvedValue({ ok: true, user: { uid: 'u' } });
    mockAuthState = { status: 'anonymous', user: { uid: 'u' }, anonCreatedAt: eightDaysAgo(), signInWithApple };
    const tree = renderScreen();
    expect(tree.root.findAllByProps({ testID: 'save-nudge-card' }).length).toBeGreaterThan(0);

    await act(async () => { await tree.root.findByProps({ testID: 'save-nudge-save' }).props.onPress(); });
    expect(signInWithApple).toHaveBeenCalled();

    // Simulate the AuthProvider's onUserChanged flip (C1) landing on the next render — the
    // nudge doesn't hide itself on 'ok'; it disappears because nudgeLevelDue recomputes.
    mockAuthState = { ...mockAuthState, status: 'authenticated' };
    act(() => { tree.update(<JernieTab />); });
    expect(tree.root.findAllByProps({ testID: 'save-nudge-card' })).toHaveLength(0);
  });

  test('snoozing hides the card via the stateful MMKV mock, without an external re-render', () => {
    mockAuthState = {
      status: 'anonymous', user: { uid: 'u' }, anonCreatedAt: eightDaysAgo(), signInWithApple: jest.fn(),
    };
    const tree = renderScreen();
    expect(tree.root.findAllByProps({ testID: 'save-nudge-card' }).length).toBeGreaterThan(0);

    act(() => { tree.root.findByProps({ testID: 'save-nudge-dismiss' }).props.onPress(); });
    expect(tree.root.findAllByProps({ testID: 'save-nudge-card' })).toHaveLength(0);
  });

  // I5: snoozing swaps the rendered CTA card from the nudge (short) to the pre-trip setup
  // checklist (tall) — the exact identity change the CTA wrapper must re-measure for
  // instead of reusing a height frozen on the nudge card, or the checklist renders clipped.
  test('snoozing swaps the card identity from the nudge to the pre-trip checklist (I5)', () => {
    mockAuthState = {
      status: 'anonymous', user: { uid: 'u' }, anonCreatedAt: eightDaysAgo(), signInWithApple: jest.fn(),
    };
    const tree = renderScreen();
    expect(tree.root.findAllByProps({ testID: 'save-nudge-card' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: 'setup-row-flights' })).toHaveLength(0);

    act(() => { tree.root.findByProps({ testID: 'save-nudge-dismiss' }).props.onPress(); });

    expect(tree.root.findAllByProps({ testID: 'save-nudge-card' })).toHaveLength(0);
    // The trip fixture's now (Aug 1) is before STOP_A's dates (Aug 10-14), so the phase
    // router underneath falls through to the pre-trip checklist once the nudge steps aside.
    expect(tree.root.findAllByProps({ testID: 'setup-row-flights' }).length).toBeGreaterThan(0);
  });

  test('shows an error on the card when Apple sign-in fails, instead of discarding it', async () => {
    const signInWithApple = jest.fn().mockResolvedValue({ ok: false, reason: 'error', message: 'network down' });
    mockAuthState = { status: 'anonymous', user: { uid: 'u' }, anonCreatedAt: eightDaysAgo(), signInWithApple };
    const tree = renderScreen();

    await act(async () => { await tree.root.findByProps({ testID: 'save-nudge-save' }).props.onPress(); });
    expect(texts(tree)).toContain('network down');
  });

  test('does nothing extra on cancellation', async () => {
    const signInWithApple = jest.fn().mockResolvedValue({ ok: false, reason: 'cancelled' });
    mockAuthState = { status: 'anonymous', user: { uid: 'u' }, anonCreatedAt: eightDaysAgo(), signInWithApple };
    const tree = renderScreen();

    await act(async () => { await tree.root.findByProps({ testID: 'save-nudge-save' }).props.onPress(); });
    expect(tree.root.findAllByProps({ testID: 'save-nudge-card' }).length).toBeGreaterThan(0);
    expect(texts(tree)).not.toContain('network down');
  });

  test('warns before adopting on a collision, and signs in only on confirm', async () => {
    const signIn = jest.fn().mockResolvedValue(undefined);
    const signInWithApple = jest.fn().mockResolvedValue({ ok: false, reason: 'credential-already-in-use', signIn });
    mockAuthState = { status: 'anonymous', user: { uid: 'u' }, anonCreatedAt: eightDaysAgo(), signInWithApple };
    mockUserTripsState = { trips: [{ tripId: 't1' }], status: 'ready' };
    mockConfirmAdopt.mockResolvedValue(true);
    const tree = renderScreen();

    await act(async () => { await tree.root.findByProps({ testID: 'save-nudge-save' }).props.onPress(); });
    expect(mockConfirmAdopt).toHaveBeenCalledWith(1);
    expect(signIn).toHaveBeenCalled();
  });

  test('does not sign in when the user declines the collision warning', async () => {
    const signIn = jest.fn().mockResolvedValue(undefined);
    const signInWithApple = jest.fn().mockResolvedValue({ ok: false, reason: 'credential-already-in-use', signIn });
    mockAuthState = { status: 'anonymous', user: { uid: 'u' }, anonCreatedAt: eightDaysAgo(), signInWithApple };
    mockUserTripsState = { trips: [{ tripId: 't1' }], status: 'ready' };
    mockConfirmAdopt.mockResolvedValue(false);
    const tree = renderScreen();

    await act(async () => { await tree.root.findByProps({ testID: 'save-nudge-save' }).props.onPress(); });
    expect(signIn).not.toHaveBeenCalled();
  });

  test('refuses to adopt while the owned-trip count is not ready, rather than trusting an empty array', async () => {
    const signIn = jest.fn().mockResolvedValue(undefined);
    const signInWithApple = jest.fn().mockResolvedValue({ ok: false, reason: 'credential-already-in-use', signIn });
    mockAuthState = { status: 'anonymous', user: { uid: 'u' }, anonCreatedAt: eightDaysAgo(), signInWithApple };
    mockUserTripsState = { trips: [], status: 'loading' };
    const tree = renderScreen();

    await act(async () => { await tree.root.findByProps({ testID: 'save-nudge-save' }).props.onPress(); });
    expect(mockConfirmAdopt).not.toHaveBeenCalled();
    expect(signIn).not.toHaveBeenCalled();
    expect(texts(tree)).toContain("Can't verify your trips");
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
