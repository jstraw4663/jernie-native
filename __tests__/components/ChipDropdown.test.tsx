jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import React from 'react';
import renderer from 'react-test-renderer';
import { View } from 'react-native';
import { ChipDropdown, type DropdownOption } from '@/src/ui/ChipDropdown';

const OPTIONS: DropdownOption[] = [
  { id: 'all', label: 'All stops' },
  { id: 'portland', label: 'Portland' },
  { id: 'bar-harbor', label: 'Bar Harbor' },
];

// `ChipDropdown` measures its trigger with `measureInWindow` before it opens. Under the RN
// jest preset every host view is a mocked class whose native methods (`measure`,
// `measureInWindow`, ...) are shared no-op `jest.fn()`s on `View.prototype` — not something a
// `createNodeMock` on this renderer can reach, since the ref lands on that mock class
// instance rather than a bare host node. Stubbing the prototype method is the supported way
// to answer the call with a concrete anchor frame.
let measureInWindowSpy: jest.SpyInstance;

beforeEach(() => {
  measureInWindowSpy = jest
    .spyOn(View.prototype as unknown as { measureInWindow: (...args: unknown[]) => void }, 'measureInWindow')
    .mockImplementation((callback: unknown) => {
      (callback as (x: number, y: number, width: number, height: number) => void)(20, 100, 96, 34);
    });
});

afterEach(() => {
  measureInWindowSpy.mockRestore();
});

function renderDropdown(overrides: Partial<React.ComponentProps<typeof ChipDropdown>> = {}) {
  let tree!: renderer.ReactTestRenderer;
  renderer.act(() => {
    tree = renderer.create(
      <ChipDropdown
        label="Portland"
        options={OPTIONS}
        selectedId="portland"
        onSelect={jest.fn()}
        testID="stop-filter"
        {...overrides}
      />,
    );
  });
  return tree;
}

function pressable(tree: renderer.ReactTestRenderer, testID: string) {
  return tree.root.findAll(node =>
    node.props.testID === testID && typeof node.props.onPress === 'function',
  )[0];
}

function menuItems(tree: renderer.ReactTestRenderer) {
  // `accessibilityRole` propagates from the `Pressable` down through the mocked host view
  // underneath it, so filter to the one instance per option that actually owns `onPress`.
  return tree.root.findAll(node =>
    node.props.accessibilityRole === 'menuitem' && typeof node.props.onPress === 'function',
  );
}

test('closed by default', () => {
  const tree = renderDropdown();
  expect(menuItems(tree)).toHaveLength(0);
  expect(pressable(tree, 'stop-filter').props.accessibilityState).toEqual({ expanded: false });
});

test('pressing the trigger renders the options', () => {
  const tree = renderDropdown();

  renderer.act(() => { pressable(tree, 'stop-filter').props.onPress(); });

  expect(menuItems(tree)).toHaveLength(OPTIONS.length);
  for (const option of OPTIONS) {
    expect(pressable(tree, `stop-filter-option-${option.id}`)).toBeTruthy();
  }
  expect(pressable(tree, 'stop-filter').props.accessibilityState).toEqual({ expanded: true });
});

test('pressing an option fires onSelect with that id and closes', () => {
  const onSelect = jest.fn();
  const tree = renderDropdown({ onSelect });

  renderer.act(() => { pressable(tree, 'stop-filter').props.onPress(); });
  renderer.act(() => { pressable(tree, 'stop-filter-option-bar-harbor').props.onPress(); });

  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(onSelect).toHaveBeenCalledWith('bar-harbor');
  expect(menuItems(tree)).toHaveLength(0);
});

test('the selected option carries accessibilityState.selected', () => {
  const tree = renderDropdown({ selectedId: 'portland' });

  renderer.act(() => { pressable(tree, 'stop-filter').props.onPress(); });

  expect(pressable(tree, 'stop-filter-option-portland').props.accessibilityState).toEqual({ selected: true });
  expect(pressable(tree, 'stop-filter-option-all').props.accessibilityState).toEqual({ selected: false });
  expect(pressable(tree, 'stop-filter-option-bar-harbor').props.accessibilityState).toEqual({ selected: false });
});
