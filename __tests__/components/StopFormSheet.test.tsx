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
  return {
    Calendar: (props: Record<string, unknown>) => ReactActual.createElement(View, props),
  };
});

const mockAddStop = jest.fn();
jest.mock('@/src/hooks/useAddStop', () => ({
  useAddStop: () => ({ addStop: (...args: unknown[]) => mockAddStop(...args) }),
}));

const mockUpdateStop = jest.fn();
const mockRemoveStop = jest.fn();
jest.mock('@/src/hooks/useEditStop', () => ({
  useEditStop: () => ({
    updateStop: (...args: unknown[]) => mockUpdateStop(...args),
    removeStop: (...args: unknown[]) => mockRemoveStop(...args),
  }),
}));

const mockConfirmDelete = jest.fn();
jest.mock('@/src/utils/confirmDelete', () => ({
  confirmDelete: (...args: unknown[]) => mockConfirmDelete(...args),
}));

const mockGeocodeCity = jest.fn();
jest.mock('@/src/lib/geocodeClient', () => ({
  geocodeCity: (...args: unknown[]) => mockGeocodeCity(...args),
}));

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { StopFormSheet } from '@/src/features/jernie/sheets/StopFormSheet';
import type { StopWithColor } from '@/src/types';

const EDITING_STOP: StopWithColor = {
  id: 'stop-1',
  tripId: 'trip-1',
  city: 'Portland',
  region: 'ME',
  emoji: '📍',
  lat: 43.6,
  lon: -70.2,
  dates: { start: '2026-05-22', end: '2026-05-24' },
  order: 0,
  color: '#2C5880',
};

function renderSheet(ui: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(ui); });
  return tree;
}

function typeCity(tree: renderer.ReactTestRenderer, text: string) {
  act(() => { tree.root.findByProps({ testID: 'stop-form-city-input' }).props.onChangeText(text); });
}
function pickDay(tree: renderer.ReactTestRenderer, dateString: string) {
  act(() => {
    tree.root.findByProps({ testID: 'stop-form-calendar' }).props.onDayPress({
      dateString,
      year: Number(dateString.slice(0, 4)),
      month: Number(dateString.slice(5, 7)),
      day: Number(dateString.slice(8, 10)),
      timestamp: new Date(dateString).getTime(),
    });
  });
}
async function pressFind(tree: renderer.ReactTestRenderer) {
  await act(async () => { await tree.root.findByProps({ testID: 'stop-form-find-button' }).props.onPress(); });
}
async function pressSubmit(tree: renderer.ReactTestRenderer) {
  await act(async () => { await tree.root.findByProps({ testID: 'stop-form-submit-button' }).props.onPress(); });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAddStop.mockResolvedValue('new-stop-id');
  mockUpdateStop.mockResolvedValue(undefined);
  mockRemoveStop.mockResolvedValue(undefined);
});

describe('StopFormSheet — add mode (no editingStop)', () => {
  test('submitting a new stop calls addStop, not updateStop', async () => {
    mockGeocodeCity.mockResolvedValue({ found: true, lat: 43.66, lon: -70.26, city: 'Portland', region: 'ME' });
    const onSaved = jest.fn();
    const tree = renderSheet(<StopFormSheet tripId="trip-1" onSaved={onSaved} />);

    typeCity(tree, 'Portland, ME');
    await pressFind(tree);
    pickDay(tree, '2026-08-10');
    pickDay(tree, '2026-08-14');
    await pressSubmit(tree);

    expect(mockAddStop).toHaveBeenCalledWith('trip-1', expect.objectContaining({ dates: { start: '2026-08-10', end: '2026-08-14' } }));
    expect(mockUpdateStop).not.toHaveBeenCalled();
  });

  test('no Remove button renders without editingStop', () => {
    const tree = renderSheet(<StopFormSheet tripId="trip-1" onSaved={jest.fn()} />);
    expect(tree.root.findAllByProps({ testID: 'remove-stop-button' })).toHaveLength(0);
  });
});

describe('StopFormSheet — edit mode (editingStop provided)', () => {
  test('the form is seeded from editingStop', () => {
    const tree = renderSheet(<StopFormSheet tripId="trip-1" editingStop={EDITING_STOP} onSaved={jest.fn()} />);
    expect(tree.root.findByProps({ testID: 'stop-form-city-input' }).props.value).toBe('Portland');
  });

  test('submitting calls updateStop with the patch, not addStop', async () => {
    const onSaved = jest.fn();
    const tree = renderSheet(<StopFormSheet tripId="trip-1" editingStop={EDITING_STOP} onSaved={onSaved} />);

    await pressSubmit(tree);

    expect(mockUpdateStop).toHaveBeenCalledWith('trip-1', 'stop-1', {
      city: 'Portland',
      region: 'ME',
      lat: 43.6,
      lon: -70.2,
      dates: { start: '2026-05-22', end: '2026-05-24' },
    });
    expect(mockAddStop).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  test('a Remove button renders', () => {
    const tree = renderSheet(<StopFormSheet tripId="trip-1" editingStop={EDITING_STOP} onSaved={jest.fn()} />);
    expect(tree.root.findByProps({ testID: 'remove-stop-button' })).toBeTruthy();
  });

  test('pressing Remove goes through confirmDelete and does not call removeStop until the confirm callback fires', () => {
    const tree = renderSheet(<StopFormSheet tripId="trip-1" editingStop={EDITING_STOP} onSaved={jest.fn()} />);

    act(() => { tree.root.findByProps({ testID: 'remove-stop-button' }).props.onPress(); });

    expect(mockConfirmDelete).toHaveBeenCalledTimes(1);
    expect(mockRemoveStop).not.toHaveBeenCalled();
  });

  test('running confirmDelete\'s onConfirm callback calls removeStop then onSaved', async () => {
    const onSaved = jest.fn();
    const tree = renderSheet(<StopFormSheet tripId="trip-1" editingStop={EDITING_STOP} onSaved={onSaved} />);

    act(() => { tree.root.findByProps({ testID: 'remove-stop-button' }).props.onPress(); });
    const { onConfirm } = mockConfirmDelete.mock.calls[0][0];

    await act(async () => { onConfirm(); await Promise.resolve(); await Promise.resolve(); });

    expect(mockRemoveStop).toHaveBeenCalledWith('trip-1', 'stop-1');
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
});
