import React from 'react';
import renderer from 'react-test-renderer';
import { Text } from 'react-native';
import { RestaurantSheet } from '@/src/features/jernie/sheets/RestaurantSheet';
import type { RestaurantBooking } from '@/src/types';

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});

jest.mock('@gorhom/bottom-sheet', () => {
  const { ScrollView } = require('react-native');
  return { BottomSheetScrollView: ScrollView };
});

function renderSheet(ui: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  renderer.act(() => { tree = renderer.create(ui); });
  return tree;
}

function texts(tree: renderer.ReactTestRenderer): string {
  return tree.root.findAllByType(Text).map(t => {
    const children = t.props.children;
    return Array.isArray(children) ? children.join('') : String(children);
  }).join(' | ');
}

const FULL: RestaurantBooking = {
  id: 'b-1', tripId: 'trip-1', stopId: 'stop-1', type: 'restaurant',
  restaurantName: 'Fore Street', date: '2026-08-11', time: '7:30 PM',
  partySize: 4, confirmationCode: 'RES123',
};

const MINIMAL: RestaurantBooking = {
  id: 'b-2', tripId: 'trip-1', stopId: 'stop-1', type: 'restaurant',
  restaurantName: 'Duckfat', date: '2026-08-12',
};

describe('RestaurantSheet', () => {
  test('renders every populated field', () => {
    const t = texts(renderSheet(
      <RestaurantSheet booking={FULL} stopColor="#123456" stopLabel="Portland" onClose={() => {}} />,
    ));
    expect(t).toContain('Fore Street');
    expect(t).toContain('Portland');
    expect(t).toContain('7:30 PM');
    expect(t).toContain('4');
    expect(t).toContain('RES123');
  });

  test('omits rows for absent optional fields rather than rendering blanks', () => {
    const t = texts(renderSheet(
      <RestaurantSheet booking={MINIMAL} stopColor="#123456" stopLabel="Portland" onClose={() => {}} />,
    ));
    expect(t).toContain('Duckfat');
    expect(t).not.toContain('Party size');
    expect(t).not.toContain('Confirmation');
    expect(t).not.toContain('undefined');
  });

  test('renders no Edit control when onEdit is omitted', () => {
    const tree = renderSheet(
      <RestaurantSheet booking={FULL} stopColor="#123456" stopLabel="Portland" onClose={() => {}} />,
    );
    expect(tree.root.findAllByProps({ testID: 'sheet-edit-button' })).toHaveLength(0);
  });

  test('calls onEdit when the Edit control is pressed', () => {
    const onEdit = jest.fn();
    const tree = renderSheet(
      <RestaurantSheet booking={FULL} stopColor="#123456" stopLabel="Portland" onEdit={onEdit} onClose={() => {}} />,
    );
    renderer.act(() => { tree.root.findByProps({ testID: 'sheet-edit-button' }).props.onPress(); });
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
