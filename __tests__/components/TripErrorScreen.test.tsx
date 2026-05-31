import React from 'react';
import renderer from 'react-test-renderer';
import { TripErrorScreen } from '@/src/features/jernie/TripErrorScreen';

test('TripErrorScreen renders without crashing', () => {
  const onRetry = jest.fn();
  const tree = renderer.create(<TripErrorScreen onRetry={onRetry} />).toJSON();
  expect(tree).toMatchSnapshot();
});

test('TripErrorScreen calls onRetry when button is pressed', () => {
  const onRetry = jest.fn();
  let instance: renderer.ReactTestRenderer;
  renderer.act(() => {
    instance = renderer.create(<TripErrorScreen onRetry={onRetry} />);
  });
  const button = instance!.root.findByProps({ testID: 'retry-button' });
  renderer.act(() => button.props.onPress());
  expect(onRetry).toHaveBeenCalledTimes(1);
});
