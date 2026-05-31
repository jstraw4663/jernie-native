import React from 'react';
import renderer from 'react-test-renderer';
import { TripLoadingScreen } from '@/src/features/jernie/TripLoadingScreen';

test('TripLoadingScreen renders without crashing', () => {
  const tree = renderer.create(<TripLoadingScreen />).toJSON();
  expect(tree).toMatchSnapshot();
});
