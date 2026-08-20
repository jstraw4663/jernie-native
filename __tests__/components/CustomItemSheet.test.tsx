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
jest.mock('@/src/utils/devTime', () => ({
  getDevNow: () => new Date('2026-07-01T12:00:00'),
}));

const mockAddCustomItineraryItem = jest.fn();
const mockUpdateItineraryItem = jest.fn();
const mockRemoveItineraryItem = jest.fn();
jest.mock('@/src/lib/itineraryWrites', () => ({
  addCustomItineraryItem: (...args: unknown[]) => mockAddCustomItineraryItem(...args),
  updateItineraryItem: (...args: unknown[]) => mockUpdateItineraryItem(...args),
  removeItineraryItem: (...args: unknown[]) => mockRemoveItineraryItem(...args),
}));

const mockConfirmDelete = jest.fn();
jest.mock('@/src/utils/confirmDelete', () => ({
  confirmDelete: (...args: unknown[]) => mockConfirmDelete(...args),
}));

let mockContextValue: Record<string, unknown>;
jest.mock('@/src/contexts/TripContext', () => ({
  useTripContext: () => mockContextValue,
}));

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { CustomItemSheet } from '@/src/features/jernie/sheets/CustomItemSheet';
import type { CustomItemSheetRef } from '@/src/features/jernie/sheets/CustomItemSheet';
import type { ItineraryDay, ItineraryItem, StopWithColor } from '@/src/types';

const STOP_A: StopWithColor = { id: 'stop-a', tripId: 'trip-1', city: 'Portland', region: 'ME', emoji: '🦞', lat: 0, lon: 0, dates: { start: '2026-07-10', end: '2026-07-12' }, order: 0, color: '#2C5880' };

const EXISTING_ITEM: ItineraryItem = {
  id: 'item-1', type: 'custom', label: 'Lobster roll run', time: '12:30 PM', notes: 'Bring cash', order: 0,
};

const DAY: ItineraryDay = { id: 'day-1', stopId: 'stop-a', dateIso: '2026-07-10', items: [EXISTING_ITEM] };
const DAY_2: ItineraryDay = { id: 'day-2', stopId: 'stop-a', dateIso: '2026-07-11', items: [] };

function renderSheet(onSaved = jest.fn()) {
  const ref = React.createRef<CustomItemSheetRef>();
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<CustomItemSheet ref={ref} tripId="trip-1" onSaved={onSaved} />);
  });
  return { tree, ref, onSaved };
}

function id(tree: renderer.ReactTestRenderer, testID: string) {
  return tree.root.findByProps({ testID });
}

function setText(tree: renderer.ReactTestRenderer, testID: string, text: string) {
  act(() => { id(tree, testID).props.onChangeText(text); });
}

async function pressSubmit(tree: renderer.ReactTestRenderer) {
  await act(async () => { await id(tree, 'custom-item-submit').props.onPress(); });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAddCustomItineraryItem.mockResolvedValue(undefined);
  mockUpdateItineraryItem.mockResolvedValue(undefined);
  mockRemoveItineraryItem.mockResolvedValue(undefined);
  mockContextValue = {
    stops: [STOP_A],
    itinerary: { 'stop-a': [DAY, DAY_2] },
  };
});

describe('CustomItemSheet — add mode with a day supplied', () => {
  test('submit is disabled while the label is blank', () => {
    const { tree, ref } = renderSheet();
    act(() => { ref.current!.present({ stopId: 'stop-a', day: DAY }); });
    expect(id(tree, 'custom-item-submit').props.disabled).toBe(true);

    setText(tree, 'custom-item-label', 'Ferry to Peaks Island');
    expect(id(tree, 'custom-item-submit').props.disabled).toBe(false);
  });

  test('omits blank optional fields from the write input', async () => {
    const { tree, ref, onSaved } = renderSheet();
    act(() => { ref.current!.present({ stopId: 'stop-a', day: DAY }); });

    setText(tree, 'custom-item-label', 'Ferry to Peaks Island');
    await pressSubmit(tree);

    expect(mockAddCustomItineraryItem).toHaveBeenCalledWith('trip-1', DAY, { label: 'Ferry to Peaks Island' });
    const input = mockAddCustomItineraryItem.mock.calls[0][2];
    expect('time' in input).toBe(false);
    expect('category' in input).toBe(false);
    expect('notes' in input).toBe(false);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  test('includes notes and time once filled in', async () => {
    const { tree, ref } = renderSheet();
    act(() => { ref.current!.present({ stopId: 'stop-a', day: DAY }); });

    setText(tree, 'custom-item-label', 'Ferry to Peaks Island');
    setText(tree, 'custom-item-time', '9:15 AM');
    setText(tree, 'custom-item-notes', 'Buy tickets at the pier');
    await pressSubmit(tree);

    expect(mockAddCustomItineraryItem).toHaveBeenCalledWith('trip-1', DAY, {
      label: 'Ferry to Peaks Island',
      time: '9:15 AM',
      notes: 'Buy tickets at the pier',
    });
  });

  test('a selected category is included in the input', async () => {
    const { tree, ref } = renderSheet();
    act(() => { ref.current!.present({ stopId: 'stop-a', day: DAY }); });

    setText(tree, 'custom-item-label', 'Beach walk');
    act(() => { id(tree, 'custom-item-category-activity').props.onPress(); });
    await pressSubmit(tree);

    expect(mockAddCustomItineraryItem.mock.calls[0][2]).toEqual({ label: 'Beach walk', category: 'activity' });
  });

  test('shows the resolved day so the user can see where the item lands', () => {
    const { tree, ref } = renderSheet();
    act(() => { ref.current!.present({ stopId: 'stop-a', day: DAY }); });
    expect(JSON.stringify(tree.toJSON())).toContain('Jul 10');
  });

  test('renders no Remove control', () => {
    const { tree, ref } = renderSheet();
    act(() => { ref.current!.present({ stopId: 'stop-a', day: DAY }); });
    expect(tree.root.findAllByProps({ testID: 'custom-item-remove' })).toHaveLength(0);
  });
});

describe('CustomItemSheet — add mode without a day', () => {
  test('submit stays disabled until a day is picked, then writes to that day', async () => {
    const { tree, ref } = renderSheet();
    act(() => { ref.current!.present({ stopId: 'stop-a' }); });

    setText(tree, 'custom-item-label', 'Ferry to Peaks Island');
    // A label alone is not enough — there is nowhere to write it yet.
    expect(id(tree, 'custom-item-submit').props.disabled).toBe(true);
    expect(mockAddCustomItineraryItem).not.toHaveBeenCalled();

    // The embedded day picker is presented on open; choosing a day resolves the target.
    act(() => { id(tree, 'day-picker-row-day-2').props.onPress(); });
    expect(id(tree, 'custom-item-submit').props.disabled).toBe(false);

    await pressSubmit(tree);
    expect(mockAddCustomItineraryItem).toHaveBeenCalledWith('trip-1', DAY_2, { label: 'Ferry to Peaks Island' });
  });
});

describe('CustomItemSheet — edit mode', () => {
  test('pre-fills the fields from the item', () => {
    const { tree, ref } = renderSheet();
    act(() => { ref.current!.present({ stopId: 'stop-a', day: DAY, editingItem: EXISTING_ITEM }); });

    expect(id(tree, 'custom-item-label').props.value).toBe('Lobster roll run');
    expect(id(tree, 'custom-item-time').props.value).toBe('12:30 PM');
    expect(id(tree, 'custom-item-notes').props.value).toBe('Bring cash');
  });

  test('submits through updateItineraryItem, not addCustomItineraryItem', async () => {
    const { tree, ref, onSaved } = renderSheet();
    act(() => { ref.current!.present({ stopId: 'stop-a', day: DAY, editingItem: EXISTING_ITEM }); });

    setText(tree, 'custom-item-label', 'Lobster roll run (Red\'s)');
    await pressSubmit(tree);

    expect(mockUpdateItineraryItem).toHaveBeenCalledWith('trip-1', DAY, 'item-1', {
      label: "Lobster roll run (Red's)",
      time: '12:30 PM',
      notes: 'Bring cash',
    });
    expect(mockAddCustomItineraryItem).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  test('Remove routes through confirmDelete and only writes from the confirm callback', async () => {
    const { tree, ref, onSaved } = renderSheet();
    act(() => { ref.current!.present({ stopId: 'stop-a', day: DAY, editingItem: EXISTING_ITEM }); });

    act(() => { id(tree, 'custom-item-remove').props.onPress(); });
    expect(mockConfirmDelete).toHaveBeenCalledTimes(1);
    expect(mockRemoveItineraryItem).not.toHaveBeenCalled();

    const { onConfirm } = mockConfirmDelete.mock.calls[0][0];
    await act(async () => { onConfirm(); await Promise.resolve(); await Promise.resolve(); });

    expect(mockRemoveItineraryItem).toHaveBeenCalledWith('trip-1', DAY, 'item-1');
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  test('a rejected write surfaces inline and does not call onSaved', async () => {
    mockUpdateItineraryItem.mockRejectedValue(new Error('network down'));
    const { tree, ref, onSaved } = renderSheet();
    act(() => { ref.current!.present({ stopId: 'stop-a', day: DAY, editingItem: EXISTING_ITEM }); });

    await pressSubmit(tree);

    expect(tree.root.findAllByProps({ testID: 'custom-item-error' }).length).toBeGreaterThan(0);
    expect(id(tree, 'custom-item-label').props.value).toBe('Lobster roll run');
    expect(onSaved).not.toHaveBeenCalled();
  });

  test('a later add does not inherit the previous edit\'s values', () => {
    const { tree, ref } = renderSheet();
    act(() => { ref.current!.present({ stopId: 'stop-a', day: DAY, editingItem: EXISTING_ITEM }); });
    expect(id(tree, 'custom-item-label').props.value).toBe('Lobster roll run');

    act(() => { ref.current!.present({ stopId: 'stop-a', day: DAY }); });
    expect(id(tree, 'custom-item-label').props.value).toBe('');
    expect(tree.root.findAllByProps({ testID: 'custom-item-remove' })).toHaveLength(0);
  });
});
