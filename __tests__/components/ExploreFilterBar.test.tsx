jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import React from 'react';
import renderer from 'react-test-renderer';
import { View } from 'react-native';
import { ExploreFilterBar, type ExploreFilterBarProps } from '@/src/features/jernie/explore/ExploreFilterBar';
import type { ExploreFilters } from '@/src/domain/explore';
import type { Stop } from '@/src/types';

const STOPS: Stop[] = [
  { id: 'portland', tripId: 'trip-1', city: 'Portland', region: 'ME', emoji: '', lat: 0, lon: 0, dates: { start: '2026-05-22', end: '2026-05-25' }, order: 0 },
  { id: 'bar-harbor', tripId: 'trip-1', city: 'Bar Harbor', region: 'ME', emoji: '', lat: 0, lon: 0, dates: { start: '2026-05-25', end: '2026-05-29' }, order: 1 },
];

const BASE_FILTERS: ExploreFilters = { stopId: 'all', category: 'all', search: '', mustOnly: false, sort: 'rating' };

// `ChipDropdown` measures its trigger with `measureInWindow` before it opens. Under the RN
// jest preset every host view is a mocked class whose native methods are shared no-op
// `jest.fn()`s on `View.prototype` — stubbing the prototype method is the supported way to
// answer the call with a concrete anchor frame. Same pattern as ChipDropdown.test.tsx.
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

function renderBar(overrides: Partial<ExploreFilterBarProps> = {}) {
  let tree!: renderer.ReactTestRenderer;
  renderer.act(() => {
    tree = renderer.create(
      <ExploreFilterBar
        stops={STOPS}
        filters={BASE_FILTERS}
        setStop={jest.fn()}
        setCategory={jest.fn()}
        setSearch={jest.fn()}
        setMustOnly={jest.fn()}
        setSort={jest.fn()}
        onOpenFilters={jest.fn()}
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

// `Text` shows up as both its own composite instance and the mocked host view beneath it,
// both echoing the same `children` prop by pass-through — the same duplication
// ChipDropdown.test.tsx's `accessibleButtons` works around for `Pressable`. Collapse a
// contiguous "same children" chain to its outermost node so each rendered number is counted
// once.
function countNodes(tree: renderer.ReactTestRenderer, value: number) {
  return tree.root.findAll(n => n.props.children === value).filter(n => {
    const parent = n.parent;
    return !(parent && parent.props.children === value);
  });
}

test('the stop bubble shows the selected stop\'s city', () => {
  const tree = renderBar({ filters: { ...BASE_FILTERS, stopId: 'bar-harbor' } });
  expect(pressable(tree, 'explore-stop-filter').props.accessibilityLabel).toBe('Bar Harbor');
});

test('picking a stop option calls setStop', () => {
  const setStop = jest.fn();
  const tree = renderBar({ setStop });

  renderer.act(() => { pressable(tree, 'explore-stop-filter').props.onPress(); });
  renderer.act(() => { pressable(tree, 'explore-stop-filter-option-bar-harbor').props.onPress(); });

  expect(setStop).toHaveBeenCalledTimes(1);
  expect(setStop).toHaveBeenCalledWith('bar-harbor');
});

test('the filter count badge is absent when no sheet filters are active', () => {
  const tree = renderBar({ filters: BASE_FILTERS });
  expect(countNodes(tree, 0)).toHaveLength(0);
  expect(countNodes(tree, 1)).toHaveLength(0);
  expect(countNodes(tree, 2)).toHaveLength(0);
});

test('the filter count badge shows "1" with a search term', () => {
  const tree = renderBar({ filters: { ...BASE_FILTERS, search: 'lobster' } });
  expect(countNodes(tree, 1)).toHaveLength(1);
});

test('the filter count badge shows "2" with a search term and must-do on', () => {
  const tree = renderBar({ filters: { ...BASE_FILTERS, search: 'lobster', mustOnly: true } });
  expect(countNodes(tree, 2)).toHaveLength(1);
});

test('the sliders button calls onOpenFilters', () => {
  const onOpenFilters = jest.fn();
  const tree = renderBar({ onOpenFilters });

  renderer.act(() => { pressable(tree, 'explore-sliders-button').props.onPress(); });

  expect(onOpenFilters).toHaveBeenCalledTimes(1);
});
