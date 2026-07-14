import React from 'react';
import renderer from 'react-test-renderer';
import { Text } from 'react-native';
import { PlaceList } from '@/src/features/jernie/explore/PlaceList';
import type { Place } from '@/src/types';

function renderList(ui: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  renderer.act(() => { tree = renderer.create(ui); });
  return tree;
}

const PLACES: Place[] = [
  { id: 'p1', tripId: 't1', stopId: 's1', name: 'Eventide', category: 'restaurant', must: true, source: 'curator', addedBy: 'u1', rating: 4.7 },
  { id: 'p2', tripId: 't1', stopId: 's1', name: 'Beehive Trail', category: 'hike', must: true, source: 'curator', addedBy: 'u1' },
];

describe('PlaceList', () => {
  test('renders the count and one card per place', () => {
    const tree = renderList(<PlaceList places={PLACES} sort="rating" onSortChange={() => {}} getStopColor={() => "#123"} accentColor="#123" addedPlaceIds={new Set()} onPlacePress={() => {}} />);
    const texts = tree.root.findAllByType(Text).map(t => Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children));
    expect(texts.join(' ')).toContain('2');
    expect(texts).toContain('Eventide');
    expect(texts).toContain('Beehive Trail');
  });

  test('renders an empty state when there are no places', () => {
    const tree = renderList(<PlaceList places={[]} sort="rating" onSortChange={() => {}} getStopColor={() => "#123"} accentColor="#123" addedPlaceIds={new Set()} onPlacePress={() => {}} />);
    const texts = tree.root.findAllByType(Text).map(t => t.props.children);
    expect(texts).toContain('No places match this filter.');
  });

  test('pressing a sort pill calls onSortChange with that sort key', () => {
    const onSortChange = jest.fn();
    const tree = renderList(<PlaceList places={PLACES} sort="rating" onSortChange={onSortChange} getStopColor={() => "#123"} accentColor="#123" addedPlaceIds={new Set()} onPlacePress={() => {}} />);
    renderer.act(() => {
      tree.root.findByProps({ testID: 'sort-name' }).props.onPress();
    });
    expect(onSortChange).toHaveBeenCalledWith('name');
  });

  test('pressing a place card calls onPlacePress with that place', () => {
    const onPlacePress = jest.fn();
    const tree = renderList(<PlaceList places={PLACES} sort="rating" onSortChange={() => {}} getStopColor={() => "#123"} accentColor="#123" addedPlaceIds={new Set()} onPlacePress={onPlacePress} />);
    const touchables = tree.root.findAllByProps({ activeOpacity: 0.85 });
    renderer.act(() => { touchables[0].props.onPress(); });
    expect(onPlacePress).toHaveBeenCalledWith(PLACES[0]);
  });
});
