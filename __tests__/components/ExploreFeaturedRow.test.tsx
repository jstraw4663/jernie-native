import React from 'react';
import renderer from 'react-test-renderer';
import { ExploreFeaturedRow } from '@/src/features/jernie/explore/ExploreFeaturedRow';
import type { Place } from '@/src/types';

function place(id: string, over: Partial<Place> = {}): Place {
  return {
    id, tripId: 'trip-1', stopId: 'bar-harbor', name: `Place ${id}`,
    category: 'restaurant', must: true, source: 'curator', addedBy: 'uid',
    ...over,
  };
}

function render(node: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  renderer.act(() => { tree = renderer.create(node); });
  return tree;
}

// Walks the rendered output rather than the instance tree: a `Text` appears at several
// levels (composite, forwardRef, host), and an interpolated line like `{n} places` arrives
// as separate children that only read correctly once joined.
function texts(tree: renderer.ReactTestRenderer): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== 'object') return;
    const json = node as { children?: unknown[] | null };
    const children = json.children ?? [];
    const own = children.filter((c): c is string => typeof c === 'string');
    if (own.length) out.push(own.join(''));
    children.forEach(walk);
  };
  walk(tree.toJSON());
  return out;
}

/** The card's own `Pressable` — the only node carrying both the handler and the label. */
function card(tree: renderer.ReactTestRenderer, testID: string) {
  return tree.root.findAll(n =>
    n.props.testID === testID
    && typeof n.props.onPress === 'function'
    && typeof n.props.accessibilityLabel === 'string',
  )[0];
}

const PHOTO = () => 'https://example.com/p.jpg';

describe('ExploreFeaturedRow', () => {
  test('renders nothing below two places — one card in a rail reads as a layout bug', () => {
    const tree = render(
      <ExploreFeaturedRow places={[place('a')]} stopCity="Bar Harbor"
        getPhotoUrl={PHOTO} addedPlaceIds={new Set()} onPlacePress={() => {}} />,
    );
    expect(tree.toJSON()).toBeNull();
  });

  test('names the stop it hand-picked from, and counts what it found', () => {
    const tree = render(
      <ExploreFeaturedRow places={[place('a'), place('b'), place('c')]} stopCity="Bar Harbor"
        getPhotoUrl={PHOTO} addedPlaceIds={new Set()} onPlacePress={() => {}} />,
    );
    expect(texts(tree)).toContain('Worth the detour');
    expect(texts(tree)).toContain('Hand-picked in Bar Harbor');
    expect(texts(tree)).toContain('3 places');
  });

  test('says "across the trip" when no stop is selected', () => {
    const tree = render(
      <ExploreFeaturedRow places={[place('a'), place('b')]}
        getPhotoUrl={PHOTO} addedPlaceIds={new Set()} onPlacePress={() => {}} />,
    );
    expect(texts(tree)).toContain('Hand-picked across the trip');
  });

  test('a card press reports the place it was pressed on', () => {
    const onPlacePress = jest.fn();
    const tree = render(
      <ExploreFeaturedRow places={[place('a'), place('b')]} stopCity="Bar Harbor"
        getPhotoUrl={PHOTO} addedPlaceIds={new Set()} onPlacePress={onPlacePress} />,
    );
    renderer.act(() => {
      card(tree, 'featured-b').props.onPress();
    });
    expect(onPlacePress).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
  });

  test('an added place says so to a screen reader', () => {
    const tree = render(
      <ExploreFeaturedRow places={[place('a'), place('b')]} stopCity="Bar Harbor"
        getPhotoUrl={PHOTO} addedPlaceIds={new Set(['b'])} onPlacePress={() => {}} />,
    );
    expect(card(tree, 'featured-b').props.accessibilityLabel).toBe('Place b, already added');
    expect(card(tree, 'featured-a').props.accessibilityLabel).toBe('Place a');
  });
});
