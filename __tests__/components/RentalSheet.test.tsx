import React from 'react';
import renderer from 'react-test-renderer';
import { Text } from 'react-native';
import { RentalSheet } from '@/src/features/jernie/sheets/RentalSheet';
import type { RentalBooking } from '@/src/types';

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

const FULL: RentalBooking = {
  id: 'b-1', tripId: 'trip-1', stopId: 'stop-1', type: 'rental',
  company: 'Hertz', carType: 'Mid-size SUV',
  pickupDate: '2026-08-10', pickupTime: '10:00 AM', pickupLocation: 'PWM Airport',
  dropoffDate: '2026-08-14', dropoffTime: '9:00 AM', dropoffLocation: 'BOS Airport',
  confirmationCode: 'CAR456',
};

const MINIMAL: RentalBooking = {
  id: 'b-2', tripId: 'trip-1', stopId: 'stop-1', type: 'rental',
  company: 'Avis',
  pickupDate: '2026-08-10', pickupLocation: 'PWM Airport',
  dropoffDate: '2026-08-14', dropoffLocation: 'PWM Airport',
};

describe('RentalSheet', () => {
  test('renders every populated field', () => {
    const t = texts(renderSheet(
      <RentalSheet booking={FULL} stopColor="#123456" stopLabel="Portland" onClose={() => {}} />,
    ));
    expect(t).toContain('Hertz');
    expect(t).toContain('Mid-size SUV');
    expect(t).toContain('PWM Airport');
    expect(t).toContain('BOS Airport');
    expect(t).toContain('10:00 AM');
    expect(t).toContain('9:00 AM');
    expect(t).toContain('CAR456');
  });

  test('omits rows for absent optional fields rather than rendering blanks', () => {
    const t = texts(renderSheet(
      <RentalSheet booking={MINIMAL} stopColor="#123456" stopLabel="Portland" onClose={() => {}} />,
    ));
    expect(t).toContain('Avis');
    expect(t).not.toContain('Car type');
    expect(t).not.toContain('Confirmation');
    expect(t).not.toContain('undefined');
  });

  test('renders no Edit control when onEdit is omitted', () => {
    const tree = renderSheet(
      <RentalSheet booking={FULL} stopColor="#123456" stopLabel="Portland" onClose={() => {}} />,
    );
    expect(tree.root.findAllByProps({ testID: 'sheet-edit-button' })).toHaveLength(0);
  });

  test('calls onEdit when the Edit control is pressed', () => {
    const onEdit = jest.fn();
    const tree = renderSheet(
      <RentalSheet booking={FULL} stopColor="#123456" stopLabel="Portland" onEdit={onEdit} onClose={() => {}} />,
    );
    renderer.act(() => { tree.root.findByProps({ testID: 'sheet-edit-button' }).props.onPress(); });
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
