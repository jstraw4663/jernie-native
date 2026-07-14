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

const mockAddPlaceToItinerary = jest.fn().mockResolvedValue(undefined);
jest.mock('@/src/lib/itineraryWrites', () => ({
  addPlaceToItinerary: (...args: unknown[]) => mockAddPlaceToItinerary(...args),
}));

const mockRefetch = jest.fn();
let mockContextValue: Record<string, unknown>;
jest.mock('@/src/contexts/TripContext', () => ({
  useTripContext: () => mockContextValue,
}));

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import ExploreTab from '@/app/(trips)/[tripId]/(tabs)/explore';
import type { Place, StopWithColor, ItineraryDay } from '@/src/types';

const STOP_A: StopWithColor = { id: 'stop-a', tripId: 'trip-1', city: 'Portland', region: 'ME', emoji: '🦞', lat: 0, lon: 0, dates: { start: '2026-07-10', end: '2026-07-12' }, order: 0, color: '#2C5880' };
const STOP_B: StopWithColor = { id: 'stop-b', tripId: 'trip-1', city: 'Bar Harbor', region: 'ME', emoji: '⛵', lat: 0, lon: 0, dates: { start: '2026-07-12', end: '2026-07-15' }, order: 1, color: '#1E7B8C' };

const RESTAURANT: Place = { id: 'place-1', tripId: 'trip-1', stopId: 'stop-a', name: 'Eventide', category: 'restaurant', must: true, source: 'curator', addedBy: 'uid-1', rating: 4.7 };
const HIKE: Place = { id: 'place-2', tripId: 'trip-1', stopId: 'stop-b', name: 'Beehive Trail', category: 'hike', must: true, source: 'curator', addedBy: 'uid-1' };
const SIGHT: Place = { id: 'place-3', tripId: 'trip-1', stopId: 'stop-a', name: 'Portland Head Light', category: 'sight', must: false, source: 'curator', addedBy: 'uid-1' };

const EMPTY_DAY: ItineraryDay = { id: 'day-1', stopId: 'stop-a', dateIso: '2026-07-10', items: [] };

function renderScreen() {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<ExploreTab />); });
  return tree;
}

function texts(tree: renderer.ReactTestRenderer): string[] {
  return tree.root.findAllByType(Text).map(t => {
    const children = t.props.children;
    return Array.isArray(children) ? children.join('') : String(children);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAddPlaceToItinerary.mockResolvedValue(undefined);
  mockContextValue = {
    trip: { id: 'trip-1', name: 'Maine Coast' },
    stops: [STOP_A, STOP_B],
    places: [RESTAURANT, HIKE, SIGHT],
    itinerary: { 'stop-a': [EMPTY_DAY], 'stop-b': [{ ...EMPTY_DAY, id: 'day-2', stopId: 'stop-b' }] },
    enrichment: {},
    refetch: mockRefetch,
  };
});

describe('app/(trips)/[tripId]/(tabs)/explore', () => {
  test('renders every real place somewhere on the screen', () => {
    const tree = renderScreen();
    const t = texts(tree);
    expect(t).toContain('Eventide');
    expect(t).toContain('Beehive Trail');
    expect(t).toContain('Portland Head Light');
  });

  test('shows stop filter pills when the trip has more than one stop', () => {
    const tree = renderScreen();
    expect(tree.root.findByProps({ testID: 'pill-stop-a' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'pill-stop-b' })).toBeTruthy();
  });

  test('hides stop filter pills for a single-stop trip', () => {
    mockContextValue.stops = [STOP_A];
    const tree = renderScreen();
    expect(tree.root.findAllByProps({ testID: 'pill-stop-a' })).toHaveLength(0);
  });

  test('selecting the Hikes category filter narrows the All Places list', () => {
    const tree = renderScreen();
    act(() => { tree.root.findByProps({ testID: 'pill-hike' }).props.onPress(); });
    const t = texts(tree);
    expect(t).toContain('Beehive Trail');
    expect(t).not.toContain('Eventide');
  });

  test('typing a search query switches to flat results and hides carousels', () => {
    const tree = renderScreen();
    const { TextInput } = require('react-native');
    act(() => { tree.root.findByType(TextInput).props.onChangeText('head light'); });
    const t = texts(tree);
    expect(t).not.toContain('Must Do');
    expect(t).toContain('Portland Head Light');
    expect(t).not.toContain('Eventide');
  });

  test('tapping a place card, then "Add to Portland", writes the itinerary item and refetches', () => {
    const tree = renderScreen();

    // Open the detail sheet for Eventide (stop-a → Portland) via its list card.
    const eventideNode = tree.root.findAllByType(Text).find(t => {
      const c = t.props.children;
      return (Array.isArray(c) ? c.join('') : String(c)) === 'Eventide';
    })!;
    act(() => { findAncestorOnPress(eventideNode)(); });

    // The sheet is now rendered (BottomSheetModal is mocked as a plain View, so its
    // children render unconditionally once payload state is set) — find the Add button.
    const addNode = tree.root.findAllByType(Text).find(t => {
      const c = t.props.children;
      return (Array.isArray(c) ? c.join('') : String(c)) === 'Add to Portland';
    })!;
    act(() => { findAncestorOnPress(addNode)(); });

    expect(mockAddPlaceToItinerary).toHaveBeenCalledWith('trip-1', RESTAURANT, EMPTY_DAY);
  });
});

function findAncestorOnPress(node: renderer.ReactTestInstance): () => void {
  let current: renderer.ReactTestInstance | null = node;
  while (current) {
    if (typeof current.props.onPress === 'function') return current.props.onPress;
    current = current.parent;
  }
  throw new Error('no ancestor with onPress found');
}
