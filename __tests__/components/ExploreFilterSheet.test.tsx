const mockPresent = jest.fn();
const mockDismiss = jest.fn();

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactLib = require('react');
  const RN = require('react-native');
  return {
    BottomSheetBackdrop: RN.View,
    BottomSheetView: RN.View,
    BottomSheetTextInput: RN.TextInput,
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
import {
  ExploreFilterSheet,
  type ExploreFilterSheetRef,
} from '@/src/features/jernie/explore/ExploreFilterSheet';

function renderSheet(props: { search: string; mustOnly: boolean; onApply: jest.Mock }) {
  const ref = createRef<ExploreFilterSheetRef>();
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<ExploreFilterSheet ref={ref} {...props} />); });
  return { ref, tree };
}

function searchInput(tree: renderer.ReactTestRenderer) {
  return tree.root.findByProps({ testID: 'explore-filter-search' });
}
function mustToggle(tree: renderer.ReactTestRenderer) {
  return tree.root.findByProps({ testID: 'explore-filter-must-toggle' });
}
function clearButton(tree: renderer.ReactTestRenderer) {
  return tree.root.findByProps({ testID: 'explore-filter-clear' });
}
function applyButton(tree: renderer.ReactTestRenderer) {
  return tree.root.findByProps({ testID: 'explore-filter-apply' });
}

beforeEach(() => { jest.clearAllMocks(); });

test('typing then dismissing without Apply does not commit anything', () => {
  const onApply = jest.fn();
  const { ref, tree } = renderSheet({ search: '', mustOnly: false, onApply });

  act(() => { ref.current?.present(); });
  expect(mockPresent).toHaveBeenCalledTimes(1);

  act(() => { searchInput(tree).props.onChangeText('lobster'); });
  act(() => { mustToggle(tree).props.onChange(true); });

  // Dismiss via the sheet's own imperative handle, same as a backdrop tap or a swipe would
  // trigger through the real @gorhom/bottom-sheet modal.
  act(() => { ref.current?.dismiss(); });

  expect(onApply).not.toHaveBeenCalled();
  expect(mockDismiss).toHaveBeenCalledTimes(1);

  // The discarded edit must not survive into the next open — present() re-snapshots from
  // the still-unchanged committed props, not the abandoned draft.
  act(() => { ref.current?.present(); });
  expect(searchInput(tree).props.value).toBe('');
  expect(mustToggle(tree).props.on).toBe(false);
});

test('Apply commits the draft', () => {
  const onApply = jest.fn();
  const { ref, tree } = renderSheet({ search: '', mustOnly: false, onApply });

  act(() => { ref.current?.present(); });
  act(() => { searchInput(tree).props.onChangeText('lobster'); });
  act(() => { mustToggle(tree).props.onChange(true); });
  act(() => { applyButton(tree).props.onPress(); });

  expect(onApply).toHaveBeenCalledTimes(1);
  expect(onApply).toHaveBeenCalledWith({ search: 'lobster', mustOnly: true });
  expect(mockDismiss).toHaveBeenCalledTimes(1);
});

test('Clear empties the draft without closing the sheet', () => {
  const onApply = jest.fn();
  const { ref, tree } = renderSheet({ search: 'chowder', mustOnly: true, onApply });

  act(() => { ref.current?.present(); });
  expect(searchInput(tree).props.value).toBe('chowder');
  expect(mustToggle(tree).props.on).toBe(true);

  act(() => { clearButton(tree).props.onPress(); });

  expect(searchInput(tree).props.value).toBe('');
  expect(mustToggle(tree).props.on).toBe(false);
  expect(onApply).not.toHaveBeenCalled();
  expect(mockDismiss).not.toHaveBeenCalled();
});
