jest.mock('@/src/hooks/useUserTrips', () => ({ useUserTrips: jest.fn() }));
jest.mock('@/src/features/jernie/TripLoadingScreen', () => ({
  TripLoadingScreen: () => {
    const { Text } = require('react-native');
    return <Text testID="loading">loading</Text>;
  },
}));
jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  return {
    Redirect: ({ href }: { href: string }) => <Text testID="redirect">{href}</Text>,
  };
});

import renderer, { act } from 'react-test-renderer';
import Index from '@/app/index';
import { useUserTrips } from '@/src/hooks/useUserTrips';

const mockUseUserTrips = useUserTrips as jest.Mock;

function renderIndex() {
  let tree: ReturnType<typeof renderer.create>;
  act(() => {
    tree = renderer.create(<Index />);
  });
  return tree!.toJSON() as unknown as { props: { testID: string }; children: string[] } | null;
}

describe('app/index', () => {
  const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;

  afterEach(() => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
  });

  test('renders the loading screen while useUserTrips is loading', () => {
    mockUseUserTrips.mockReturnValue({ trips: [], status: 'loading' });
    const tree = renderIndex();
    expect(tree?.props.testID).toBe('loading');
  });

  test('0 trips in __DEV__ redirects to the seeded dev trip', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    mockUseUserTrips.mockReturnValue({ trips: [], status: 'ready' });
    const tree = renderIndex();
    expect(tree?.children[0]).toBe('/(trips)/dev-trip-001/(tabs)/jernie');
  });

  test('0 trips outside __DEV__ redirects to onboarding step 1', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    mockUseUserTrips.mockReturnValue({ trips: [], status: 'ready' });
    const tree = renderIndex();
    expect(tree?.children[0]).toBe('/onboarding/step-1');
  });

  test('exactly 1 trip redirects directly to it', () => {
    mockUseUserTrips.mockReturnValue({
      trips: [{ tripId: 'trip-abc', role: 'organizer', joinedAt: 1 }],
      status: 'ready',
    });
    const tree = renderIndex();
    expect(tree?.children[0]).toBe('/(trips)/trip-abc/(tabs)/jernie');
  });

  test('2+ trips redirects to the (home) trip list', () => {
    mockUseUserTrips.mockReturnValue({
      trips: [
        { tripId: 'trip-a', role: 'organizer', joinedAt: 1 },
        { tripId: 'trip-b', role: 'traveler', joinedAt: 2 },
      ],
      status: 'ready',
    });
    const tree = renderIndex();
    expect(tree?.children[0]).toBe('/(home)');
  });

  test('status: error with 0 trips falls back like a brand-new user', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    mockUseUserTrips.mockReturnValue({ trips: [], status: 'error' });
    const tree = renderIndex();
    expect(tree?.children[0]).toBe('/onboarding/step-1');
  });
});
