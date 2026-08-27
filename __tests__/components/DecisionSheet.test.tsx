const mockPresent = jest.fn();
const mockDismiss = jest.fn();

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactLib = require('react');
  const RN = require('react-native');
  return {
    BottomSheetBackdrop: RN.View,
    BottomSheetView: RN.View,
    BottomSheetModal: ReactLib.forwardRef(
      (props: { children?: React.ReactNode }, ref: React.Ref<unknown>) => {
        ReactLib.useImperativeHandle(ref, () => ({ present: mockPresent, dismiss: mockDismiss }));
        return ReactLib.createElement(RN.View, null, props.children);
      },
    ),
    useBottomSheetSpringConfigs: () => ({}),
  };
});

jest.mock('@/src/contexts/SheetContext', () => ({
  useSheetContext: () => ({ increment: jest.fn(), decrement: jest.fn() }),
}));

import React, { createRef } from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { ArrowsDownUpIcon } from 'phosphor-react-native/src/icons/ArrowsDownUp';
import { TrashIcon } from 'phosphor-react-native/src/icons/Trash';
import {
  DecisionSheet, DecisionSheetError,
  type DecisionRequest, type DecisionSheetRef,
} from '@/src/features/jernie/sheets/DecisionSheet';

function visibleText(tree: renderer.ReactTestRenderer): string {
  return tree.root.findAllByType(Text).map(node => {
    const children = node.props.children;
    return Array.isArray(children) ? children.join('') : String(children);
  }).join(' | ');
}

function pressable(tree: renderer.ReactTestRenderer, testID: string) {
  return tree.root.findAll(node =>
    node.props.testID === testID && typeof node.props.onPress === 'function',
  )[0];
}

function removeRequest(overrides: Partial<DecisionRequest> = {}): DecisionRequest {
  return {
    Glyph: TrashIcon,
    tone: 'destructive',
    title: 'Remove Eventide?',
    message: 'This removes it from your itinerary.',
    cancelLabel: 'Cancel',
    confirmLabel: 'Remove',
    busyLabel: 'Removing…',
    errorMessage: "Couldn't remove this item. Try again.",
    testIdPrefix: 'remove-entry',
    onConfirm: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function moveRequest(overrides: Partial<DecisionRequest> = {}): DecisionRequest {
  return {
    Glyph: ArrowsDownUpIcon,
    tone: 'action',
    title: 'Move Popovers to 5:30 PM?',
    message: 'It is booked for 3:30 PM with 4 guests.',
    cancelLabel: 'Keep 3:30 PM',
    confirmLabel: 'Move it',
    busyLabel: 'Moving…',
    errorMessage: "Couldn't save this move. Your original itinerary is unchanged.",
    testIdPrefix: 'move-entry',
    onConfirm: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => { jest.clearAllMocks(); });

test('presents the requested confirmation and runs the destructive write only after confirm', async () => {
  const ref = createRef<DecisionSheetRef>();
  const onConfirm = jest.fn().mockResolvedValue(undefined);
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<DecisionSheet ref={ref} />); });

  act(() => { ref.current?.present(removeRequest({ onConfirm })); });

  expect(mockPresent).toHaveBeenCalledTimes(1);
  expect(visibleText(tree)).toContain('Remove Eventide?');
  expect(onConfirm).not.toHaveBeenCalled();

  await act(async () => {
    pressable(tree, 'remove-entry-confirm').props.onPress();
    await Promise.resolve();
  });

  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(mockDismiss).toHaveBeenCalledTimes(1);
});

test('keeps the sheet open and surfaces a retryable error when removal fails', async () => {
  const ref = createRef<DecisionSheetRef>();
  const onConfirm = jest.fn().mockRejectedValue(new Error('offline'));
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<DecisionSheet ref={ref} />); });
  act(() => { ref.current?.present(removeRequest({ onConfirm })); });

  await act(async () => {
    pressable(tree, 'remove-entry-confirm').props.onPress();
    await Promise.resolve();
  });

  expect(mockDismiss).not.toHaveBeenCalled();
  expect(tree.root.findByProps({ testID: 'remove-entry-error' })).toBeTruthy();
  expect(visibleText(tree)).toContain("Couldn't remove this item. Try again.");
});

test('a DecisionSheetError names the real failure instead of the generic sentence', async () => {
  const ref = createRef<DecisionSheetRef>();
  const onConfirm = jest.fn().mockRejectedValue(
    new DecisionSheetError('Eventide is still here — Blue Hill Inn could not be removed first.'),
  );
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<DecisionSheet ref={ref} />); });
  act(() => { ref.current?.present(removeRequest({ onConfirm })); });

  await act(async () => {
    pressable(tree, 'remove-entry-confirm').props.onPress();
    await Promise.resolve();
  });

  expect(visibleText(tree)).toContain('Blue Hill Inn could not be removed first.');
  expect(visibleText(tree)).not.toContain("Couldn't remove this item. Try again.");
});

test('waits for approval before moving a booked item', async () => {
  const ref = createRef<DecisionSheetRef>();
  const onConfirm = jest.fn().mockResolvedValue(undefined);
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<DecisionSheet ref={ref} />); });
  act(() => { ref.current?.present(moveRequest({ onConfirm })); });

  expect(mockPresent).toHaveBeenCalledTimes(1);
  expect(visibleText(tree)).toContain('Move Popovers to 5:30 PM?');
  expect(onConfirm).not.toHaveBeenCalled();

  await act(async () => {
    pressable(tree, 'move-entry-confirm').props.onPress();
    await Promise.resolve();
  });

  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(mockDismiss).toHaveBeenCalledTimes(1);
});

test('keeps a failed move open with a retryable error', async () => {
  const ref = createRef<DecisionSheetRef>();
  const onConfirm = jest.fn().mockRejectedValue(new Error('offline'));
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<DecisionSheet ref={ref} />); });
  act(() => { ref.current?.present(moveRequest({ onConfirm })); });

  await act(async () => {
    pressable(tree, 'move-entry-confirm').props.onPress();
    await Promise.resolve();
  });

  expect(mockDismiss).not.toHaveBeenCalled();
  expect(tree.root.findByProps({ testID: 'move-entry-error' })).toBeTruthy();
});

test('cancel dismisses without running the write', () => {
  const ref = createRef<DecisionSheetRef>();
  const onConfirm = jest.fn().mockResolvedValue(undefined);
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<DecisionSheet ref={ref} />); });
  act(() => { ref.current?.present(removeRequest({ onConfirm })); });

  act(() => { pressable(tree, 'remove-entry-cancel').props.onPress(); });

  expect(onConfirm).not.toHaveBeenCalled();
  expect(mockDismiss).toHaveBeenCalledTimes(1);
});
