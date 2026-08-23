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
// The trust gate, the three-way prompt and the trip copy live in useCollisionSignIn
// (__tests__/useCollisionSignIn.test.tsx). This screen owns delegating to it and mapping each
// outcome onto the nudge card's error slot.
const mockAdoptOnCollision = jest.fn();
jest.mock('@/src/hooks/useCollisionSignIn', () => ({
  useCollisionSignIn: () => mockAdoptOnCollision,
}));

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import JernieTab from '@/app/(trips)/[tripId]/(tabs)/jernie';
import type { Trip, StopWithColor } from '@/src/types';

const TRIP: Trip = {
  id: 'trip-1',
  name: 'New England',
  ownerUid: 'uid-1',
  createdAt: 0,
  pills: [],
  inviteToken: 'tok',
  colorPack: { id: 'pack', stopColors: ['#2C5880', '#1E7B8C'], heroGradient: ['#111111', '#222222'] },
  // flights:true = "I still need to book this". The CTA row is silent on a false intent,
  // unlike the deleted checklist card, which rendered all four rows regardless.
  setupIntent: { flights: true, stays: false, car: false, restaurants: false },
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
  mockAdoptOnCollision.mockReset().mockResolvedValue({ status: 'signed-in', failed: 0 });
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

// Session 4 replaced CTACardZone's three-card phase router with ONE row whose content is
// chosen by priority: save nudge > unmet setup > (Session 5: gap) > nothing. The four-row
// pre-trip checklist is gone by design — a row cannot hold four setup rows — so these
// assert the surviving behaviour: the row appears, acts, and dismisses.
describe('JernieTab — CTA row', () => {
  test('renders the real, data-driven CTA rather than the hardcoded mock carousel', () => {
    const tree = renderScreen();
    const t = texts(tree);
    // Driven by trip.setupIntent, and its action targets the unmet intent by name.
    expect(tree.root.findAllByProps({ testID: 'setup-row-flights' }).length).toBeGreaterThan(0);
    expect(t).toContain('New England');
    // Text unique to the deleted mock carousel's fixed cards must never come back.
    expect(t).not.toContain('Dinner Reservation');
  });

  test('mounts exactly one CTA row', () => {
    const tree = renderScreen();
    // Host nodes only — findAllByProps also matches the composite that passed the prop down.
    const hosts = tree.root.findAll(n => n.props.testID === 'cta-setup' && typeof n.type === 'string');
    expect(hosts).toHaveLength(1);
  });

  test('the CTA action opens the booking form for the unmet intent', () => {
    const tree = renderScreen();
    act(() => { tree.root.findByProps({ testID: 'setup-row-flights' }).props.onPress(); });
    // The booking sheet is now presenting a flight form.
    expect(tree.root.findAllByProps({ testID: 'booking-form-leg-0-airline' }).length).toBeGreaterThan(0);
  });

  test('a met intent silences the row', () => {
    mockContextValue.trip = { ...TRIP, setupIntent: { flights: false, stays: false, car: false, restaurants: false } };
    const tree = renderScreen();
    expect(tree.root.findAllByProps({ testID: 'cta-setup' })).toHaveLength(0);
  });

  test('dismissing the setup row hides it', () => {
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
  // Anchored to the mocked getDevNow() (2026-08-01T12:00:00, same fixture used for the
  // phase/itinerary tests below), not real Date.now() — the nudge's `now` is getDevNow()
  // (T-minor: it used to be Date.now(), independently of this same screen's own dev
  // time-travel), so an anonCreatedAt anchored to the real wall clock would drift out of
  // sync with it and the "due" math would go negative whenever this suite runs on a date
  // after the fixture.
  const MOCK_NOW = new Date('2026-08-01T12:00:00').getTime();
  const eightDaysAgo = () => MOCK_NOW - 8 * DAY;

  // T-minor: the nudge's `now` used to be Date.now() instead of this same screen's own
  // getDevNow() — real Date.now() during a test run is today's actual wall-clock date,
  // which is well past the 21-day 'firm' threshold for an 8-day-old anonCreatedAt anchored
  // to the mocked Aug 1 fixture, so the bug would show 'firm' copy where 'gentle' is due.
  test('nudge level is computed against getDevNow(), not the real wall clock', () => {
    mockAuthState = {
      status: 'anonymous', user: { uid: 'u' }, anonCreatedAt: eightDaysAgo(), signInWithApple: jest.fn(),
    };
    const tree = renderScreen();
    expect(texts(tree)).toContain('Save your trip'); // gentle copy
    expect(texts(tree)).not.toContain('This trip only exists on this phone'); // firm copy
  });

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

  // I5: snoozing hands the single CTA row from the nudge down to the next-highest thing
  // that has something to say. The row is one component now, so the height-remeasure bug
  // this originally guarded cannot recur — but the priority handover still has to work.
  test('snoozing hands the row from the nudge down to the setup content (I5)', () => {
    mockAuthState = {
      status: 'anonymous', user: { uid: 'u' }, anonCreatedAt: eightDaysAgo(), signInWithApple: jest.fn(),
    };
    const tree = renderScreen();
    expect(tree.root.findAllByProps({ testID: 'save-nudge-card' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: 'setup-row-flights' })).toHaveLength(0);

    act(() => { tree.root.findByProps({ testID: 'save-nudge-dismiss' }).props.onPress(); });

    expect(tree.root.findAllByProps({ testID: 'save-nudge-card' })).toHaveLength(0);
    // With the nudge snoozed, the unmet flights intent is the highest-priority thing left.
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

  test('hands a collision to the collision flow', async () => {
    const signIn = jest.fn().mockResolvedValue(undefined);
    const signInWithApple = jest.fn().mockResolvedValue({ ok: false, reason: 'credential-already-in-use', signIn });
    mockAuthState = { status: 'anonymous', user: { uid: 'u' }, anonCreatedAt: eightDaysAgo(), signInWithApple };
    const tree = renderScreen();

    await act(async () => { await tree.root.findByProps({ testID: 'save-nudge-save' }).props.onPress(); });
    expect(mockAdoptOnCollision).toHaveBeenCalledWith(signIn);
    expect(texts(tree)).not.toContain("Couldn't sign in");
  });

  test('shows no error when the user backs out of the collision prompt', async () => {
    const signInWithApple = jest.fn().mockResolvedValue({
      ok: false, reason: 'credential-already-in-use', signIn: jest.fn(),
    });
    mockAuthState = { status: 'anonymous', user: { uid: 'u' }, anonCreatedAt: eightDaysAgo(), signInWithApple };
    mockAdoptOnCollision.mockResolvedValue({ status: 'cancelled' });
    const tree = renderScreen();

    await act(async () => { await tree.root.findByProps({ testID: 'save-nudge-save' }).props.onPress(); });
    expect(texts(tree)).not.toContain("Couldn't sign in");
  });

  test('refuses while the owned-trip count is not ready, rather than trusting an empty array', async () => {
    const signInWithApple = jest.fn().mockResolvedValue({
      ok: false, reason: 'credential-already-in-use', signIn: jest.fn(),
    });
    mockAuthState = { status: 'anonymous', user: { uid: 'u' }, anonCreatedAt: eightDaysAgo(), signInWithApple };
    mockAdoptOnCollision.mockResolvedValue({ status: 'untrusted' });
    const tree = renderScreen();

    await act(async () => { await tree.root.findByProps({ testID: 'save-nudge-save' }).props.onPress(); });
    expect(texts(tree)).toContain("Can't verify your trips");
  });

  // The nudge fires only for a uid with something genuinely at risk, so a copy that hasn't
  // landed yet is exactly the case this card must not misreport as a sign-in failure.
  test('says the trip is still copying when the sign-in landed but a copy did not', async () => {
    const signInWithApple = jest.fn().mockResolvedValue({
      ok: false, reason: 'credential-already-in-use', signIn: jest.fn(),
    });
    mockAuthState = { status: 'anonymous', user: { uid: 'u' }, anonCreatedAt: eightDaysAgo(), signInWithApple };
    mockAdoptOnCollision.mockResolvedValue({ status: 'signed-in', failed: 1 });
    const tree = renderScreen();

    await act(async () => { await tree.root.findByProps({ testID: 'save-nudge-save' }).props.onPress(); });
    expect(texts(tree)).toContain('still copying across');
  });
});
