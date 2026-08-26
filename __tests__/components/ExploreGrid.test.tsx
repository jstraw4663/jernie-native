jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import React from 'react';
import renderer from 'react-test-renderer';
import { View, Text } from 'react-native';
import { ExploreGrid } from '@/src/features/jernie/explore/ExploreGrid';
import type { Place } from '@/src/types';

// `ChipDropdown` (the sort control) measures its trigger before opening. Same prototype stub
// as ChipDropdown.test.tsx and ExploreFilterBar.test.tsx.
let measureInWindowSpy: jest.SpyInstance;

beforeEach(() => {
  measureInWindowSpy = jest
    .spyOn(View.prototype as unknown as { measureInWindow: (...a: unknown[]) => void }, 'measureInWindow')
    .mockImplementation((callback: unknown) => {
      (callback as (x: number, y: number, w: number, h: number) => void)(280, 300, 90, 34);
    });
});

// FlashList schedules a layout update after mount. Left running, it lands after the test
// finishes and logs from a torn-down environment — the exact fault that had `npx jest`
// exiting 1 while printing all-pass. Flush it inside `act`, then unmount every tree.
const mounted: renderer.ReactTestRenderer[] = [];

afterEach(async () => {
  await renderer.act(async () => {
    mounted.splice(0).forEach(tree => tree.unmount());
  });
  measureInWindowSpy.mockRestore();
});

function place(id: string, over: Partial<Place> = {}): Place {
  return {
    id, tripId: 'trip-1', stopId: 'bar-harbor', name: `Place ${id}`,
    category: 'restaurant', must: false, source: 'curator', addedBy: 'uid',
    ...over,
  };
}

async function renderGrid(over: Partial<React.ComponentProps<typeof ExploreGrid>> = {}) {
  let tree!: renderer.ReactTestRenderer;
  await renderer.act(async () => {
    tree = renderer.create(
      <ExploreGrid
        places={[place('a'), place('b'), place('c')]}
        sort="rating"
        onSortChange={jest.fn()}
        getPhotoUrl={() => undefined}
        addedPlaceIds={new Set()}
        onPlacePress={jest.fn()}
        {...over}
      />,
    );
  });
  mounted.push(tree);
  return tree;
}

function cell(tree: renderer.ReactTestRenderer, testID: string) {
  return tree.root.findAll(n =>
    n.props.testID === testID
    && typeof n.props.onPress === 'function'
    && typeof n.props.accessibilityLabel === 'string',
  )[0];
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

describe('ExploreGrid', () => {
  test('renders one cell per place', async () => {
    const tree = await renderGrid();
    expect(cell(tree, 'grid-a')).toBeDefined();
    expect(cell(tree, 'grid-b')).toBeDefined();
    expect(cell(tree, 'grid-c')).toBeDefined();
  });

  test('pressing a cell reports the place it was pressed on', async () => {
    const onPlacePress = jest.fn();
    const tree = await renderGrid({ onPlacePress });
    renderer.act(() => { cell(tree, 'grid-b').props.onPress(); });
    expect(onPlacePress).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
  });

  test('an added place carries the Added note; a must-do carries Must do', async () => {
    const tree = await renderGrid({
      places: [place('a'), place('b', { must: true }), place('c')],
      addedPlaceIds: new Set(['a']),
    });
    expect(texts(tree)).toContain('Added');
    expect(texts(tree)).toContain('Must do');
  });

  test('an added must-do says Added, not Must do — itinerary state wins', async () => {
    const tree = await renderGrid({
      places: [place('a', { must: true })],
      addedPlaceIds: new Set(['a']),
    });
    expect(texts(tree)).toContain('Added');
    expect(texts(tree)).not.toContain('Must do');
  });

  test('the sort control shows the current sort, and picking one reports it', async () => {
    const onSortChange = jest.fn();
    const tree = await renderGrid({ sort: 'name', onSortChange });
    expect(texts(tree)).toContain('A – Z');

    renderer.act(() => {
      tree.root.findAll(n =>
        n.props.testID === 'explore-sort' && typeof n.props.onPress === 'function',
      )[0].props.onPress();
    });
    renderer.act(() => {
      tree.root.findAll(n =>
        n.props.testID === 'explore-sort-option-price-asc' && typeof n.props.onPress === 'function',
      )[0].props.onPress();
    });
    expect(onSortChange).toHaveBeenCalledWith('price-asc');
  });

  test('with nothing to show it renders the empty action, not an empty grid', async () => {
    const tree = await renderGrid({
      places: [],
      empty: <Text>Clear filters</Text>,
    });
    expect(texts(tree)).toContain('Clear filters');
  });

  test('the featured carousel rides in the list header, so there is one scroll surface', async () => {
    const tree = await renderGrid({ header: <Text>Worth the detour</Text> });
    expect(texts(tree)).toContain('Worth the detour');
    expect(texts(tree)).toContain('Everything nearby');
  });
});
