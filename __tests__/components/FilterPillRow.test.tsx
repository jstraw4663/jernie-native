import React from 'react';
import renderer from 'react-test-renderer';
import { Text } from 'react-native';
import { FilterPillRow } from '@/src/features/jernie/explore/FilterPillRow';

function renderRow(ui: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  renderer.act(() => { tree = renderer.create(ui); });
  return tree;
}

const ITEMS = [
  { id: 'all', label: 'All' },
  { id: 'restaurant', label: 'Eats' },
  { id: 'hike', label: 'Hikes', color: '#2F6B47' },
];

describe('FilterPillRow', () => {
  test('renders one pill per item', () => {
    const tree = renderRow(<FilterPillRow items={ITEMS} activeId="all" onSelect={() => {}} defaultColor="#123456" />);
    const texts = tree.root.findAllByType(Text).map(t => t.props.children);
    expect(texts).toContain('All');
    expect(texts).toContain('Eats');
    expect(texts).toContain('Hikes');
  });

  test('pressing a pill calls onSelect with its id', () => {
    const onSelect = jest.fn();
    const tree = renderRow(<FilterPillRow items={ITEMS} activeId="all" onSelect={onSelect} defaultColor="#123456" />);
    renderer.act(() => {
      tree.root.findByProps({ testID: 'pill-restaurant' }).props.onPress();
    });
    expect(onSelect).toHaveBeenCalledWith('restaurant');
  });

  test('the active pill uses its own color override when present', () => {
    const tree = renderRow(<FilterPillRow items={ITEMS} activeId="hike" onSelect={() => {}} defaultColor="#123456" />);
    const activePill = tree.root.findByProps({ testID: 'pill-hike' });
    expect(activePill.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: '#2F6B47' })]),
    );
  });
});
