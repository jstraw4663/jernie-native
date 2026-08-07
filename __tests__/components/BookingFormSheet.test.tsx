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

const mockAddBooking = jest.fn();
const mockUpdateBooking = jest.fn();
const mockRemoveBooking = jest.fn();
jest.mock('@/src/hooks/useBooking', () => ({
  useBooking: () => ({
    addBooking: (...args: unknown[]) => mockAddBooking(...args),
    updateBooking: (...args: unknown[]) => mockUpdateBooking(...args),
    removeBooking: (...args: unknown[]) => mockRemoveBooking(...args),
  }),
}));

const mockConfirmDelete = jest.fn();
jest.mock('@/src/utils/confirmDelete', () => ({
  confirmDelete: (...args: unknown[]) => mockConfirmDelete(...args),
}));

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { BookingFormSheet } from '@/src/features/jernie/sheets/BookingFormSheet';
import type { BookingFormSheetRef } from '@/src/features/jernie/sheets/BookingFormSheet';
import type { HotelBooking } from '@/src/types';

const EDITING_BOOKING: HotelBooking = {
  id: 'booking-1',
  tripId: 'trip-1',
  stopId: 'stop-1',
  type: 'hotel',
  hotelName: 'The Press Hotel',
  checkIn: '2026-08-10',
  checkOut: '2026-08-14',
  roomType: 'King',
};

function renderSheet(onSaved = jest.fn()) {
  const ref = React.createRef<BookingFormSheetRef>();
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<BookingFormSheet ref={ref} tripId="trip-1" onSaved={onSaved} />);
  });
  return { tree, ref, onSaved };
}

function id(tree: renderer.ReactTestRenderer, testID: string) {
  return tree.root.findByProps({ testID });
}

function setText(tree: renderer.ReactTestRenderer, field: string, text: string) {
  act(() => { id(tree, `booking-form-${field}`).props.onChangeText(text); });
}

function pickDate(tree: renderer.ReactTestRenderer, field: string, dateString: string) {
  act(() => { id(tree, `booking-form-${field}`).props.onPress(); });
  act(() => {
    id(tree, `booking-form-${field}-calendar`).props.onDayPress({
      dateString,
      year: Number(dateString.slice(0, 4)),
      month: Number(dateString.slice(5, 7)),
      day: Number(dateString.slice(8, 10)),
      timestamp: new Date(dateString).getTime(),
    });
  });
}

async function pressSubmit(tree: renderer.ReactTestRenderer) {
  await act(async () => { await id(tree, 'booking-form-submit-button').props.onPress(); });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAddBooking.mockResolvedValue('new-booking-id');
  mockUpdateBooking.mockResolvedValue(undefined);
  mockRemoveBooking.mockResolvedValue(undefined);
});

describe('BookingFormSheet — before present()', () => {
  test('renders no form until a payload arrives', () => {
    const { tree } = renderSheet();
    expect(tree.root.findAllByProps({ testID: 'booking-form-submit-button' })).toHaveLength(0);
  });
});

describe('BookingFormSheet — add mode', () => {
  test('submitting calls addBooking with the presented type and stopId', async () => {
    const { tree, ref, onSaved } = renderSheet();
    act(() => { ref.current!.present({ type: 'hotel', stopId: 'stop-1' }); });

    setText(tree, 'hotelName', 'The Press Hotel');
    pickDate(tree, 'checkIn', '2026-08-10');
    pickDate(tree, 'checkOut', '2026-08-14');
    await pressSubmit(tree);

    expect(mockAddBooking).toHaveBeenCalledWith('trip-1', {
      type: 'hotel',
      stopId: 'stop-1',
      hotelName: 'The Press Hotel',
      checkIn: '2026-08-10',
      checkOut: '2026-08-14',
    });
    expect(mockUpdateBooking).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  test('renders no Remove button', () => {
    const { tree, ref } = renderSheet();
    act(() => { ref.current!.present({ type: 'hotel', stopId: 'stop-1' }); });
    expect(tree.root.findAllByProps({ testID: 'remove-booking-button' })).toHaveLength(0);
  });

  test('re-presenting for a different type swaps the rendered field set', () => {
    const { tree, ref } = renderSheet();
    act(() => { ref.current!.present({ type: 'hotel', stopId: 'stop-1' }); });
    expect(tree.root.findAllByProps({ testID: 'booking-form-hotelName' }).length).toBeGreaterThan(0);

    act(() => { ref.current!.present({ type: 'restaurant', stopId: 'stop-2' }); });
    expect(tree.root.findAllByProps({ testID: 'booking-form-hotelName' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: 'booking-form-restaurantName' }).length).toBeGreaterThan(0);
  });

  test('a stale edit payload does not leak into a later add', () => {
    const { tree, ref } = renderSheet();
    act(() => { ref.current!.present({ type: 'hotel', stopId: 'stop-1', editingBooking: EDITING_BOOKING }); });
    expect(tree.root.findAllByProps({ testID: 'remove-booking-button' }).length).toBeGreaterThan(0);

    act(() => { ref.current!.present({ type: 'hotel', stopId: 'stop-1' }); });
    expect(tree.root.findAllByProps({ testID: 'remove-booking-button' })).toHaveLength(0);
    expect(id(tree, 'booking-form-hotelName').props.value).toBe('');
  });
});

describe('BookingFormSheet — edit mode', () => {
  test('seeds the form from editingBooking', () => {
    const { tree, ref } = renderSheet();
    act(() => { ref.current!.present({ type: 'hotel', stopId: 'stop-1', editingBooking: EDITING_BOOKING }); });
    expect(id(tree, 'booking-form-hotelName').props.value).toBe('The Press Hotel');
    expect(id(tree, 'booking-form-roomType').props.value).toBe('King');
  });

  test('submitting calls updateBooking with a patch that omits type and stopId', async () => {
    const { tree, ref, onSaved } = renderSheet();
    act(() => { ref.current!.present({ type: 'hotel', stopId: 'stop-1', editingBooking: EDITING_BOOKING }); });

    setText(tree, 'roomType', 'Suite');
    await pressSubmit(tree);

    expect(mockUpdateBooking).toHaveBeenCalledWith('trip-1', 'booking-1', {
      hotelName: 'The Press Hotel',
      checkIn: '2026-08-10',
      checkOut: '2026-08-14',
      roomType: 'Suite',
    });
    const patch = mockUpdateBooking.mock.calls[0][2];
    expect('type' in patch).toBe(false);
    expect('stopId' in patch).toBe(false);
    expect(mockAddBooking).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  test('renders a Remove button', () => {
    const { tree, ref } = renderSheet();
    act(() => { ref.current!.present({ type: 'hotel', stopId: 'stop-1', editingBooking: EDITING_BOOKING }); });
    expect(id(tree, 'remove-booking-button')).toBeTruthy();
  });

  test('Remove routes through confirmDelete and does not call removeBooking until confirmed', () => {
    const { tree, ref } = renderSheet();
    act(() => { ref.current!.present({ type: 'hotel', stopId: 'stop-1', editingBooking: EDITING_BOOKING }); });

    act(() => { id(tree, 'remove-booking-button').props.onPress(); });

    expect(mockConfirmDelete).toHaveBeenCalledTimes(1);
    expect(mockRemoveBooking).not.toHaveBeenCalled();
  });

  test("confirmDelete's onConfirm calls removeBooking then onSaved", async () => {
    const { tree, ref, onSaved } = renderSheet();
    act(() => { ref.current!.present({ type: 'hotel', stopId: 'stop-1', editingBooking: EDITING_BOOKING }); });

    act(() => { id(tree, 'remove-booking-button').props.onPress(); });
    const { onConfirm } = mockConfirmDelete.mock.calls[0][0];
    await act(async () => { onConfirm(); await Promise.resolve(); await Promise.resolve(); });

    expect(mockRemoveBooking).toHaveBeenCalledWith('trip-1', 'booking-1');
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  test('a rejected write surfaces inline and does not call onSaved', async () => {
    mockUpdateBooking.mockRejectedValue(new Error('network down'));
    const { tree, ref, onSaved } = renderSheet();
    act(() => { ref.current!.present({ type: 'hotel', stopId: 'stop-1', editingBooking: EDITING_BOOKING }); });

    await pressSubmit(tree);

    expect(tree.root.findAllByProps({ testID: 'booking-form-error' }).length).toBeGreaterThan(0);
    expect(onSaved).not.toHaveBeenCalled();
  });
});
