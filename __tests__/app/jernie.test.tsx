jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const ReactLib = require('react');
  const RN = require('react-native');
  return function MockSwipeable(props: { children?: React.ReactNode; testID?: string }) {
    return ReactLib.createElement(RN.View, { testID: props.testID }, props.children);
  };
});
jest.mock('react-native-gesture-handler', () => {
  const actual = jest.requireActual('react-native-gesture-handler');
  const ReactLib = require('react');
  return {
    ...actual,
    GestureDetector: ({ children }: { children?: React.ReactNode }) =>
      ReactLib.createElement(ReactLib.Fragment, null, children),
  };
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
    BottomSheetView: RN.View,
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
const mockRemoveItineraryItemById = jest.fn();
const mockReorderItineraryDayItems = jest.fn();
jest.mock('@/src/lib/itineraryWrites', () => ({
  ...jest.requireActual('@/src/lib/itineraryWrites'),
  removeItineraryItemById: (...args: unknown[]) => mockRemoveItineraryItemById(...args),
  reorderItineraryDayItems: (...args: unknown[]) => mockReorderItineraryDayItems(...args),
}));
const mockRemoveBooking = jest.fn();
jest.mock('@/src/lib/bookingWrites', () => ({
  ...jest.requireActual('@/src/lib/bookingWrites'),
  removeBooking: (...args: unknown[]) => mockRemoveBooking(...args),
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
jest.mock('@/src/hooks/useUserProfile', () => ({
  useUserProfile: () => ({ preferredMapsApp: undefined, refetch: jest.fn(), status: 'ready' }),
}));
jest.mock('@/src/features/jernie/sheets/MapAppSheet', () => {
  const ReactLib = require('react');
  return {
    MapAppSheet: ReactLib.forwardRef((_props: unknown, ref: React.Ref<unknown>) => {
      ReactLib.useImperativeHandle(ref, () => ({ present: jest.fn(), dismiss: jest.fn() }));
      return null;
    }),
  };
});

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import JernieTab from '@/app/(trips)/[tripId]/(tabs)/jernie';
import type { TimelineEntry } from '@/src/domain/itineraryTimeline';
import type { ItineraryItem, RestaurantBooking, Trip, StopWithColor } from '@/src/types';

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

// Gesture Handler's `createHandler` schedules a `setImmediate` to push its config down. Left
// mounted, that immediate fires after Jest tears the environment down, reads `Platform` off a
// dead module registry and hard-crashes the worker — a green run that still exits non-zero.
// Unmounting every screen after each test cancels it.
const mounted: renderer.ReactTestRenderer[] = [];

function renderScreen() {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<JernieTab />); });
  mounted.push(tree);
  return tree;
}

afterEach(() => {
  act(() => { mounted.splice(0).forEach(tree => tree.unmount()); });
});

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
  mockRemoveItineraryItemById.mockReset().mockResolvedValue(undefined);
  mockReorderItineraryDayItems.mockReset().mockResolvedValue(undefined);
  mockRemoveBooking.mockReset().mockResolvedValue(undefined);
});

describe('JernieTab — itinerary reorder', () => {
  const itineraryItems: ItineraryItem[] = [
    { id: 'coffee', type: 'custom', label: 'Coffee', time: 'morning', order: 0 },
    { id: 'museum', type: 'custom', label: 'Museum', time: 'afternoon', order: 1 },
  ];

  function configureDay(items = itineraryItems) {
    mockContextValue.itinerary = {
      'stop-a': [{
        id: 'day-1', stopId: 'stop-a', dateIso: '2026-08-10', items,
      }],
    };
  }

  test('persists a loose-item drop immediately through the atomic writer', async () => {
    configureDay();
    const tree = renderScreen();
    const day = tree.root.findAll(node =>
      node.props.day && typeof node.props.onEntryDrop === 'function',
    )[0];
    const coffee = day.props.day.bands
      .flatMap((band: { entries: TimelineEntry[] }) => band.entries)
      .find((entry: TimelineEntry) => entry.id === 'item:coffee');

    await act(async () => {
      day.props.onEntryDrop({
        entry: coffee,
        placement: { stopId: 'stop-a', dayId: 'day-1', itemId: 'coffee' },
        destination: { stopId: 'stop-a', dayId: 'day-1', dateIso: '2026-08-10' },
        targetItemId: 'museum',
        afterTarget: true,
        time: 'afternoon',
        destinationLabel: 'Afternoon',
      });
      await Promise.resolve();
    });

    expect(mockReorderItineraryDayItems).toHaveBeenCalledWith(
      'trip-1', 'stop-a', 'day-1',
      { itemId: 'coffee', toIndex: 1, time: 'afternoon' },
    );
  });

  test('does not write when a long press is released in its original slot', () => {
    configureDay();
    const tree = renderScreen();
    const day = tree.root.findAll(node =>
      node.props.day && typeof node.props.onEntryDrop === 'function',
    )[0];
    const coffee = day.props.day.bands
      .flatMap((band: { entries: TimelineEntry[] }) => band.entries)
      .find((entry: TimelineEntry) => entry.id === 'item:coffee');

    act(() => {
      day.props.onEntryDrop({
        entry: coffee,
        placement: { stopId: 'stop-a', dayId: 'day-1', itemId: 'coffee' },
        destination: { stopId: 'stop-a', dayId: 'day-1', dateIso: '2026-08-10' },
        targetItemId: 'coffee',
        afterTarget: false,
        destinationLabel: 'Morning',
      });
    });

    expect(mockReorderItineraryDayItems).not.toHaveBeenCalled();
  });

  test('does not persist a booking-backed move until Move it is approved', async () => {
    const booking: RestaurantBooking = {
      id: 'booking-1', tripId: 'trip-1', stopId: 'stop-a', type: 'restaurant',
      restaurantName: 'Jordan Pond House', date: '2026-08-10', time: '3:30 PM',
      partySize: 4, confirmationCode: 'ABC123',
    };
    configureDay([
      { id: 'popovers', type: 'booking', bookingId: booking.id, order: 0 },
      { id: 'dinner', type: 'custom', label: 'Dinner', time: '5:30 PM', order: 1 },
    ]);
    mockContextValue.bookings = [booking];
    const tree = renderScreen();
    const day = tree.root.findAll(node =>
      node.props.day && typeof node.props.onEntryDrop === 'function',
    )[0];
    const popovers = day.props.day.bands
      .flatMap((band: { entries: TimelineEntry[] }) => band.entries)
      .find((entry: TimelineEntry) => entry.id === 'item:popovers');

    act(() => {
      day.props.onEntryDrop({
        entry: popovers,
        placement: { stopId: 'stop-a', dayId: 'day-1', itemId: 'popovers' },
        destination: { stopId: 'stop-a', dayId: 'day-1', dateIso: '2026-08-10' },
        targetItemId: 'dinner',
        afterTarget: false,
        time: '5:30 PM',
        destinationLabel: '5:30 PM',
      });
    });

    expect(mockReorderItineraryDayItems).not.toHaveBeenCalled();
    expect(texts(tree)).toContain('Move Jordan Pond House to 5:30 PM?');
    expect(texts(tree)).toContain('booked for 3:30 PM with 4 guests');

    const confirm = tree.root.findAll(node =>
      node.props.testID === 'move-entry-confirm' && typeof node.props.onPress === 'function',
    )[0];
    await act(async () => { confirm.props.onPress(); await Promise.resolve(); });

    expect(mockReorderItineraryDayItems).toHaveBeenCalledWith(
      'trip-1', 'stop-a', 'day-1',
      { itemId: 'popovers', toIndex: 0, time: '5:30 PM' },
    );
  });
});

describe('JernieTab — itinerary removal', () => {
  const entriesInRenderedDay = (tree: renderer.ReactTestRenderer): TimelineEntry[] => {
    const renderedDay = tree.root.findAll(node =>
      node.props.day && typeof node.props.onEntryRemove === 'function',
    )[0].props.day;
    return [
      ...renderedDay.bands.flatMap((band: { entries: TimelineEntry[] }) => band.entries),
      ...renderedDay.unscheduled,
    ];
  };

  test('hides a confirmed custom row locally and Undo cancels without any database write', async () => {
    const item: ItineraryItem = {
      id: 'item-1', type: 'custom', label: 'Museum', time: '10:00', order: 0,
    };
    mockContextValue.itinerary = {
      'stop-a': [{
        id: 'day-1', stopId: 'stop-a', dateIso: '2026-08-10', items: [item],
      }],
    };
    const tree = renderScreen();
    const day = tree.root.findAll(node =>
      node.props.day && typeof node.props.onEntryRemove === 'function',
    )[0];
    const entry: TimelineEntry = {
      id: 'item:item-1', dateIso: '2026-08-10', stopId: 'stop-a', title: 'Museum',
      category: 'activity',
      time: { raw: '10:00', label: '10:00 AM', precision: 'hard', band: 'morning', sortMinutes: 600 },
      source: { kind: 'custom', itemId: 'item-1' }, order: 0,
      secured: false, confirmed: false, requiresMoveConfirmation: false,
      past: false, next: false,
    };

    act(() => { day.props.onEntryRemove(entry); });
    expect(texts(tree)).toContain('Remove Museum?');

    const confirm = tree.root.findAll(node =>
      node.props.testID === 'remove-entry-confirm' && typeof node.props.onPress === 'function',
    )[0];
    await act(async () => { confirm.props.onPress(); await Promise.resolve(); });

    expect(mockRemoveItineraryItemById).not.toHaveBeenCalled();
    expect(entriesInRenderedDay(tree).some(entry => entry.id === 'item:item-1')).toBe(false);
    expect(texts(tree)).toContain('Removed Museum');

    const undo = tree.root.findAll(node =>
      node.props.testID === 'itinerary-undo-action' && typeof node.props.onPress === 'function',
    )[0];
    act(() => { undo.props.onPress(); });

    expect(mockRemoveItineraryItemById).not.toHaveBeenCalled();
    expect(entriesInRenderedDay(tree).some(entry => entry.id === 'item:item-1')).toBe(true);
    expect(tree.root.findAllByProps({ testID: 'itinerary-undo-toast' })).toHaveLength(0);
  });

  test('commits the queued removal only when the Undo window expires', async () => {
    const item: ItineraryItem = {
      id: 'item-1', type: 'custom', label: 'Museum', time: '10:00', order: 0,
    };
    mockContextValue.itinerary = {
      'stop-a': [{
        id: 'day-1', stopId: 'stop-a', dateIso: '2026-08-10', items: [item],
      }],
    };
    const tree = renderScreen();
    const day = tree.root.findAll(node =>
      node.props.day && typeof node.props.onEntryRemove === 'function',
    )[0];
    const entry = entriesInRenderedDay(tree).find(candidate => candidate.id === 'item:item-1')!;

    act(() => { day.props.onEntryRemove(entry); });
    const confirm = tree.root.findAll(node =>
      node.props.testID === 'remove-entry-confirm' && typeof node.props.onPress === 'function',
    )[0];
    await act(async () => { confirm.props.onPress(); await Promise.resolve(); });
    expect(mockRemoveItineraryItemById).not.toHaveBeenCalled();

    const toast = tree.root.findAll(node =>
      node.props.title === 'Museum' && typeof node.props.onDismiss === 'function',
    )[0];
    await act(async () => { toast.props.onDismiss(); await Promise.resolve(); });

    expect(mockRemoveItineraryItemById).toHaveBeenCalledWith(
      'trip-1', 'stop-a', 'day-1', 'item-1',
    );
  });

  test('delays a booking cascade until expiry and then commits by booking id', async () => {
    const booking: RestaurantBooking = {
      id: 'booking-1', tripId: 'trip-1', stopId: 'stop-a', type: 'restaurant',
      restaurantName: 'Eventide', date: '2026-08-10', time: '19:00',
    };
    mockContextValue.bookings = [booking];
    const tree = renderScreen();
    const day = tree.root.findAll(node =>
      node.props.day && typeof node.props.onEntryRemove === 'function',
    )[0];
    const entry = entriesInRenderedDay(tree).find(candidate =>
      candidate.source.kind === 'booking' && candidate.source.bookingId === booking.id)!;

    act(() => { day.props.onEntryRemove(entry); });
    const confirm = tree.root.findAll(node =>
      node.props.testID === 'remove-entry-confirm' && typeof node.props.onPress === 'function',
    )[0];
    await act(async () => { confirm.props.onPress(); await Promise.resolve(); });

    expect(mockRemoveBooking).not.toHaveBeenCalled();
    expect(entriesInRenderedDay(tree).some(candidate =>
      candidate.source.kind === 'booking' && candidate.source.bookingId === booking.id)).toBe(false);

    const toast = tree.root.findAll(node =>
      node.props.title === 'Eventide' && typeof node.props.onDismiss === 'function',
    )[0];
    await act(async () => { toast.props.onDismiss(); await Promise.resolve(); });

    expect(mockRemoveBooking).toHaveBeenCalledWith('trip-1', 'booking-1');
  });

  test('re-shows the row and offers Retry if the delayed commit fails', async () => {
    const item: ItineraryItem = {
      id: 'item-1', type: 'custom', label: 'Museum', time: '10:00', order: 0,
    };
    mockContextValue.itinerary = {
      'stop-a': [{
        id: 'day-1', stopId: 'stop-a', dateIso: '2026-08-10', items: [item],
      }],
    };
    mockRemoveItineraryItemById.mockRejectedValueOnce(new Error('offline'));
    const tree = renderScreen();
    const day = tree.root.findAll(node =>
      node.props.day && typeof node.props.onEntryRemove === 'function',
    )[0];
    const entry = entriesInRenderedDay(tree).find(candidate => candidate.id === 'item:item-1')!;

    act(() => { day.props.onEntryRemove(entry); });
    const confirm = tree.root.findAll(node =>
      node.props.testID === 'remove-entry-confirm' && typeof node.props.onPress === 'function',
    )[0];
    await act(async () => { confirm.props.onPress(); await Promise.resolve(); });
    const toast = tree.root.findAll(node =>
      node.props.title === 'Museum' && typeof node.props.onDismiss === 'function',
    )[0];
    await act(async () => { toast.props.onDismiss(); await Promise.resolve(); });

    expect(entriesInRenderedDay(tree).some(candidate => candidate.id === 'item:item-1')).toBe(true);
    expect(texts(tree)).toContain("Couldn't remove Museum");
    expect(texts(tree)).toContain('Retry');
  });
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
