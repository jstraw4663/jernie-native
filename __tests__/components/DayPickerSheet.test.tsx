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

// Fixed "today" — day rows key their past/today/future treatment off this.
jest.mock('@/src/utils/devTime', () => ({
  getDevNow: () => new Date('2026-07-11T12:00:00'),
}));

let mockContextValue: Record<string, unknown>;
jest.mock('@/src/contexts/TripContext', () => ({
  useTripContext: () => mockContextValue,
}));

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { DayPickerSheet } from '@/src/features/jernie/sheets/DayPickerSheet';
import type { DayPickerSheetRef } from '@/src/features/jernie/sheets/DayPickerSheet';
import type { ItineraryDay, StopWithColor } from '@/src/types';

const STOP_A: StopWithColor = { id: 'stop-a', tripId: 'trip-1', city: 'Portland', region: 'ME', emoji: '🦞', lat: 0, lon: 0, dates: { start: '2026-07-10', end: '2026-07-12' }, order: 0, color: '#2C5880' };
const STOP_B: StopWithColor = { id: 'stop-b', tripId: 'trip-1', city: 'Bar Harbor', region: 'ME', emoji: '⛵', lat: 0, lon: 0, dates: { start: '2026-07-13', end: '2026-07-15' }, order: 1, color: '#1E7B8C' };

const A_PAST:   ItineraryDay = { id: 'day-a1', stopId: 'stop-a', dateIso: '2026-07-10', items: [{ id: 'i1', type: 'custom', label: 'Coffee', order: 0 }] };
const A_TODAY:  ItineraryDay = { id: 'day-a2', stopId: 'stop-a', dateIso: '2026-07-11', items: [] };
const A_FUTURE: ItineraryDay = { id: 'day-a3', stopId: 'stop-a', dateIso: '2026-07-12', items: [{ id: 'i2', type: 'custom', label: 'Dinner', order: 0 }, { id: 'i3', type: 'custom', label: 'Walk', order: 1 }] };
const B_FUTURE: ItineraryDay = { id: 'day-b1', stopId: 'stop-b', dateIso: '2026-07-13', items: [] };

function renderSheet() {
  const ref = React.createRef<DayPickerSheetRef>();
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<DayPickerSheet ref={ref} />); });
  return { tree, ref };
}

function texts(tree: renderer.ReactTestRenderer): string {
  return tree.root.findAllByType(Text).map(t => {
    const children = t.props.children;
    return Array.isArray(children) ? children.join('') : String(children);
  }).join(' | ');
}

function row(tree: renderer.ReactTestRenderer, dayId: string) {
  return tree.root.findByProps({ testID: `day-picker-row-${dayId}` });
}

beforeEach(() => {
  mockContextValue = {
    stops: [STOP_A, STOP_B],
    itinerary: { 'stop-a': [A_PAST, A_TODAY, A_FUTURE], 'stop-b': [B_FUTURE] },
  };
});

describe('DayPickerSheet', () => {
  test('renders nothing until present() supplies a payload', () => {
    const { tree } = renderSheet();
    expect(tree.root.findAllByProps({ testID: 'day-picker-scope-stop' })).toHaveLength(0);
  });

  test('defaults to "This stop" scope and lists only that stop\'s days', () => {
    const { tree, ref } = renderSheet();
    act(() => { ref.current!.present({ stopId: 'stop-a', onPick: () => {} }); });

    expect(tree.root.findAllByProps({ testID: 'day-picker-row-day-a1' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: 'day-picker-row-day-a3' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: 'day-picker-row-day-b1' })).toHaveLength(0);
  });

  test('switching to "All stops" lists every stop\'s days under stop headers', () => {
    const { tree, ref } = renderSheet();
    act(() => { ref.current!.present({ stopId: 'stop-a', onPick: () => {} }); });
    act(() => { row(tree, 'day-a1'); tree.root.findByProps({ testID: 'day-picker-scope-all' }).props.onPress(); });

    expect(tree.root.findAllByProps({ testID: 'day-picker-row-day-b1' }).length).toBeGreaterThan(0);
    const t = texts(tree);
    expect(t).toContain('Portland');
    expect(t).toContain('Bar Harbor');
  });

  test('a day before today is disabled and pressing it does not call onPick', () => {
    const onPick = jest.fn();
    const { tree, ref } = renderSheet();
    act(() => { ref.current!.present({ stopId: 'stop-a', onPick }); });

    expect(row(tree, 'day-a1').props.disabled).toBe(true);
    act(() => { row(tree, 'day-a1').props.onPress(); });
    expect(onPick).not.toHaveBeenCalled();
  });

  test('pressing a future day calls onPick with that exact day', () => {
    const onPick = jest.fn();
    const { tree, ref } = renderSheet();
    act(() => { ref.current!.present({ stopId: 'stop-a', onPick }); });

    act(() => { row(tree, 'day-a3').props.onPress(); });
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(A_FUTURE);
  });

  test("today's row is selectable and carries a today marker", () => {
    const onPick = jest.fn();
    const { tree, ref } = renderSheet();
    act(() => { ref.current!.present({ stopId: 'stop-a', onPick }); });

    expect(row(tree, 'day-a2').props.disabled).toBe(false);
    expect(tree.root.findAllByProps({ testID: 'day-picker-today-badge' }).length).toBeGreaterThan(0);
    act(() => { row(tree, 'day-a2').props.onPress(); });
    expect(onPick).toHaveBeenCalledWith(A_TODAY);
  });

  test('shows each day\'s item count', () => {
    const { tree, ref } = renderSheet();
    act(() => { ref.current!.present({ stopId: 'stop-a', onPick: () => {} }); });
    const t = texts(tree);
    expect(t).toContain('2 items');
    expect(t).toContain('No items');
  });

  test('a stop with no itinerary days renders an empty state instead of crashing', () => {
    const { tree, ref } = renderSheet();
    act(() => { ref.current!.present({ stopId: 'stop-unknown', onPick: () => {} }); });
    expect(texts(tree)).toContain('No days');
  });

  test('re-presenting for a different stop resets the scope back to "This stop"', () => {
    const { tree, ref } = renderSheet();
    act(() => { ref.current!.present({ stopId: 'stop-a', onPick: () => {} }); });
    act(() => { tree.root.findByProps({ testID: 'day-picker-scope-all' }).props.onPress(); });
    expect(tree.root.findAllByProps({ testID: 'day-picker-row-day-b1' }).length).toBeGreaterThan(0);

    act(() => { ref.current!.present({ stopId: 'stop-a', onPick: () => {} }); });
    expect(tree.root.findAllByProps({ testID: 'day-picker-row-day-b1' })).toHaveLength(0);
  });
});
