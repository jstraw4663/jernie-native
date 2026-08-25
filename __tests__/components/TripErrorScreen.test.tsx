import React from 'react';
import renderer from 'react-test-renderer';
import { TripErrorScreen } from '@/src/features/jernie/TripErrorScreen';

// Without `act` the first render has not flushed when `toJSON()` runs, so the snapshot
// records `null` and the assertion proves nothing.
test('TripErrorScreen renders without crashing', () => {
  const onRetry = jest.fn();
  let tree!: renderer.ReactTestRenderer;
  renderer.act(() => { tree = renderer.create(<TripErrorScreen onRetry={onRetry} />); });

  expect(tree.toJSON()).toMatchSnapshot();

  renderer.act(() => { tree.unmount(); });
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
