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
    BottomSheetView: RN.View,
    BottomSheetTextInput: RN.TextInput,
    BottomSheetModal: MockBottomSheetModal,
    BottomSheetBackdrop: RN.View,
    useBottomSheetSpringConfigs: () => ({}),
  };
});
jest.mock('@/src/contexts/SheetContext', () => ({
  useSheetContext: () => ({ increment: jest.fn(), decrement: jest.fn() }),
}));

const mockAddPlaceToItinerary = jest.fn().mockResolvedValue(undefined);
jest.mock('@/src/lib/itineraryWrites', () => ({
  addPlaceToItinerary: (...args: unknown[]) => mockAddPlaceToItinerary(...args),
}));

jest.mock('@/src/utils/devTime', () => ({
  getDevNow: () => new Date('2026-07-01T12:00:00'),
}));

const mockRefetch = jest.fn();
let mockContextValue: Record<string, unknown>;
jest.mock('@/src/contexts/TripContext', () => ({
  useTripContext: () => mockContextValue,
}));

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { View } from 'react-native';
import ExploreTab from '@/app/(trips)/[tripId]/(tabs)/explore';
import { ExploreFilterProvider } from '@/src/contexts/ExploreFilterContext';
import type { Place, StopWithColor, ItineraryDay } from '@/src/types';

const STOP_A: StopWithColor = { id: 'stop-a', tripId: 'trip-1', city: 'Portland', region: 'ME', emoji: '', lat: 0, lon: 0, dates: { start: '2026-07-10', end: '2026-07-12' }, order: 0, color: '#2C5880' };
const STOP_B: StopWithColor = { id: 'stop-b', tripId: 'trip-1', city: 'Bar Harbor', region: 'ME', emoji: '', lat: 0, lon: 0, dates: { start: '2026-07-12', end: '2026-07-15' }, order: 1, color: '#1E7B8C' };

const RESTAURANT: Place = { id: 'place-1', tripId: 'trip-1', stopId: 'stop-a', name: 'Eventide', category: 'restaurant', must: true, source: 'curator', addedBy: 'uid-1', rating: 4.7 };
const HIKE: Place = { id: 'place-2', tripId: 'trip-1', stopId: 'stop-b', name: 'Beehive Trail', category: 'hike', must: true, source: 'curator', addedBy: 'uid-1' };
const SIGHT: Place = { id: 'place-3', tripId: 'trip-1', stopId: 'stop-a', name: 'Portland Head Light', category: 'sight', must: false, source: 'curator', addedBy: 'uid-1' };

const EMPTY_DAY: ItineraryDay = { id: 'day-1', stopId: 'stop-a', dateIso: '2026-07-10', items: [] };

// `ChipDropdown` measures its trigger before opening. Same prototype stub the two component
// suites use — under the RN jest preset every host view shares one no-op `measureInWindow`.
let measureInWindowSpy: jest.SpyInstance;
const mounted: renderer.ReactTestRenderer[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  mockAddPlaceToItinerary.mockResolvedValue(undefined);
  measureInWindowSpy = jest
    .spyOn(View.prototype as unknown as { measureInWindow: (...a: unknown[]) => void }, 'measureInWindow')
    .mockImplementation((callback: unknown) => {
      (callback as (x: number, y: number, w: number, h: number) => void)(20, 100, 96, 34);
    });
  mockContextValue = {
    trip: { id: 'trip-1', name: 'Maine Coast' },
    stops: [STOP_A, STOP_B],
    places: [RESTAURANT, HIKE, SIGHT],
    itinerary: { 'stop-a': [EMPTY_DAY], 'stop-b': [{ ...EMPTY_DAY, id: 'day-2', stopId: 'stop-b' }] },
    enrichment: {},
    refetch: mockRefetch,
  };
});

// FlashList schedules a layout update after mount; unmount inside `act` so it cannot land
// after the environment is torn down.
afterEach(async () => {
  await act(async () => { mounted.splice(0).forEach(tree => tree.unmount()); });
  measureInWindowSpy.mockRestore();
});

async function renderScreen() {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <ExploreFilterProvider><ExploreTab /></ExploreFilterProvider>,
    );
  });
  mounted.push(tree);
  return tree;
}

function texts(tree: renderer.ReactTestRenderer): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== 'object') return;
    const children = (node as { children?: unknown[] | null }).children ?? [];
    const own = children.filter((c): c is string => typeof c === 'string');
    if (own.length) out.push(own.join(''));
    children.forEach(walk);
  };
  walk(tree.toJSON());
  return out;
}

function pressable(tree: renderer.ReactTestRenderer, testID: string) {
  return tree.root.findAll(node =>
    node.props.testID === testID && typeof node.props.onPress === 'function',
  )[0];
}

describe('app/(trips)/[tripId]/(tabs)/explore', () => {
  test('defaults the stop to the one the trip is on, never "All stops"', async () => {
    // getDevNow is mocked to 2026-07-01, before the trip — so the default is the NEXT stop.
    const tree = await renderScreen();
    expect(pressable(tree, 'explore-stop-filter').props.accessibilityLabel).toBe('Portland');
  });

  test('shows only the defaulted stop\'s places, not the whole trip', async () => {
    const tree = await renderScreen();
    const t = texts(tree);
    expect(t).toContain('Eventide');
    expect(t).toContain('Portland Head Light');
    expect(t).not.toContain('Beehive Trail');
  });

  test('switching the stop bubble re-queries the grid', async () => {
    const tree = await renderScreen();
    await act(async () => { pressable(tree, 'explore-stop-filter').props.onPress(); });
    await act(async () => { pressable(tree, 'explore-stop-filter-option-stop-b').props.onPress(); });

    const t = texts(tree);
    expect(t).toContain('Beehive Trail');
    expect(t).not.toContain('Eventide');
  });

  test('the type bubble narrows the grid', async () => {
    const tree = await renderScreen();
    await act(async () => { pressable(tree, 'explore-stop-filter').props.onPress(); });
    await act(async () => { pressable(tree, 'explore-stop-filter-option-all').props.onPress(); });
    await act(async () => { pressable(tree, 'explore-type-filter').props.onPress(); });
    await act(async () => { pressable(tree, 'explore-type-filter-option-hike').props.onPress(); });

    const t = texts(tree);
    expect(t).toContain('Beehive Trail');
    expect(t).not.toContain('Eventide');
  });

  test('exactly one carousel — "Worth the detour" and nothing else', async () => {
    // Two must-dos on the defaulted stop, because one card in a rail hides the section.
    const SECOND_MUST: Place = { ...SIGHT, id: 'place-4', name: 'Fore Street', must: true };
    mockContextValue.places = [RESTAURANT, HIKE, SIGHT, SECOND_MUST];
    const tree = await renderScreen();
    const t = texts(tree);
    expect(t.filter(line => line === 'Worth the detour')).toHaveLength(1);
    expect(t).toContain('Everything nearby');
    // The retired six-rail vocabulary must be gone.
    expect(t).not.toContain('Must Do');
    expect(t).not.toContain('On the Water');
  });

  test('a filter that matches nothing offers the way out, not a grey sentence', async () => {
    mockContextValue.places = [HIKE];
    const tree = await renderScreen();
    // Defaults to stop-a (Portland); the only place lives on stop-b.
    expect(texts(tree)).toContain('No places match these filters');
    expect(pressable(tree, 'explore-empty')).toBeDefined();
  });

  test('clearing from the empty state restores the derived default, not "All stops"', async () => {
    mockContextValue.places = [HIKE];
    const tree = await renderScreen();
    await act(async () => { pressable(tree, 'explore-empty').props.onPress(); });
    expect(pressable(tree, 'explore-stop-filter').props.accessibilityLabel).toBe('Portland');
  });

  test('tapping a place, then the footer action, opens the day picker without writing yet', async () => {
    const tree = await renderScreen();
    await act(async () => { pressable(tree, 'grid-place-1').props.onPress(); });
    await act(async () => { pressable(tree, 'detail-footer-action').props.onPress(); });

    expect(tree.root.findAllByProps({ testID: `day-picker-row-${EMPTY_DAY.id}` }).length).toBeGreaterThan(0);
    expect(mockAddPlaceToItinerary).not.toHaveBeenCalled();
  });

  test('picking a day writes the itinerary item and refetches', async () => {
    const tree = await renderScreen();
    await act(async () => { pressable(tree, 'grid-place-1').props.onPress(); });
    await act(async () => { pressable(tree, 'detail-footer-action').props.onPress(); });
    await act(async () => {
      tree.root.findByProps({ testID: `day-picker-row-${EMPTY_DAY.id}` }).props.onPress();
      await Promise.resolve();
    });

    expect(mockAddPlaceToItinerary).toHaveBeenCalledWith('trip-1', RESTAURANT, EMPTY_DAY);
    expect(mockRefetch).toHaveBeenCalled();
  });

  test('the picker offers days from the place\'s own stop, not the filter\'s', async () => {
    const tree = await renderScreen();
    // Widen to All stops so a stop-b place is reachable while the filter is not on stop-b.
    await act(async () => { pressable(tree, 'explore-stop-filter').props.onPress(); });
    await act(async () => { pressable(tree, 'explore-stop-filter-option-all').props.onPress(); });

    await act(async () => { pressable(tree, 'grid-place-2').props.onPress(); });
    await act(async () => { pressable(tree, 'detail-footer-action').props.onPress(); });

    expect(tree.root.findAllByProps({ testID: 'day-picker-row-day-2' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: `day-picker-row-${EMPTY_DAY.id}` })).toHaveLength(0);
  });
});
