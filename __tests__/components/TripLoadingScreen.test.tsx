import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { TripLoadingScreen } from '@/src/features/jernie/TripLoadingScreen';

// The spinner is an infinite `withRepeat(..., -1)`. Left mounted, its scheduler callback
// outlives the test file and fires after Jest tears the environment down — which surfaces as
// "trying to `import` a file after the Jest environment has been torn down" and makes an
// otherwise fully green run exit 1. Unmounting cancels the animation.
test('TripLoadingScreen renders without crashing', () => {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<TripLoadingScreen />); });

  expect(tree.toJSON()).toMatchSnapshot();

  act(() => { tree.unmount(); });
});
