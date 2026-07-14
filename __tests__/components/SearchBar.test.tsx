import React from 'react';
import renderer from 'react-test-renderer';
import { TextInput } from 'react-native';
import { SearchBar } from '@/src/features/jernie/explore/SearchBar';

function renderBar(ui: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  renderer.act(() => { tree = renderer.create(ui); });
  return tree;
}

describe('SearchBar', () => {
  test('renders the current value', () => {
    const tree = renderBar(<SearchBar value="lobster" onChangeText={() => {}} />);
    expect(tree.root.findByType(TextInput).props.value).toBe('lobster');
  });

  test('typing calls onChangeText', () => {
    const onChangeText = jest.fn();
    const tree = renderBar(<SearchBar value="" onChangeText={onChangeText} />);
    renderer.act(() => {
      tree.root.findByType(TextInput).props.onChangeText('eventide');
    });
    expect(onChangeText).toHaveBeenCalledWith('eventide');
  });
});
