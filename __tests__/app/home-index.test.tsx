jest.mock('@/src/hooks/useUserTrips', () => ({ useUserTrips: jest.fn() }));
jest.mock('@/src/features/jernie/TripLoadingScreen', () => ({
  TripLoadingScreen: () => {
    const { Text } = require('react-native');
    return <Text testID="loading">loading</Text>;
  },
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import renderer, { act } from 'react-test-renderer';
import MyTripsScreen from '@/app/(home)/index';
import { useUserTrips } from '@/src/hooks/useUserTrips';

const mockUseUserTrips = useUserTrips as jest.Mock;

function renderScreen() {
  let tree: ReturnType<typeof renderer.create>;
  act(() => {
    tree = renderer.create(<MyTripsScreen />);
  });
  return tree!;
}

describe('app/(home)/index', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  test('renders the loading screen while useUserTrips is loading', () => {
    mockUseUserTrips.mockReturnValue({ trips: [], status: 'loading' });
    const tree = renderScreen();
    const loading = tree.root.findByProps({ testID: 'loading' });
    expect(loading).toBeTruthy();
  });

  test('renders an empty state with 0 trips', () => {
    mockUseUserTrips.mockReturnValue({ trips: [], status: 'ready' });
    const tree = renderScreen();
    expect(tree.root.findAllByProps({ testID: 'trip-row-trip-a' })).toHaveLength(0);
    expect(JSON.stringify(tree.toJSON())).toContain("haven't joined any trips");
  });

  test('renders one row per trip and navigates to the trip on press', () => {
    mockUseUserTrips.mockReturnValue({
      trips: [
        { tripId: 'trip-a', role: 'organizer', joinedAt: 1 },
        { tripId: 'trip-b', role: 'traveler', joinedAt: 2 },
      ],
      status: 'ready',
    });
    const tree = renderScreen();
    const rowA = tree.root.findByProps({ testID: 'trip-row-trip-a' });
    expect(tree.root.findByProps({ testID: 'trip-row-trip-b' })).toBeTruthy();

    act(() => {
      rowA.props.onPress();
    });
    expect(mockPush).toHaveBeenCalledWith('/(trips)/trip-a/(tabs)/jernie');
  });
});
