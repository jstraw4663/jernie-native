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
// The dev seed is written once per device and its trip is readable only by the uid that
// wrote it, so the __DEV__ fallback has to know whether the current uid is that one.
let mockAuthState: { user: { uid: string } | null };
jest.mock('@/src/contexts/AuthContext', () => ({ useAuth: () => mockAuthState }));
const mockGetSeedOwnerUid = jest.fn();
jest.mock('@/src/lib/devSeed', () => ({
  getSeedOwnerUid: () => mockGetSeedOwnerUid(),
}));

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

  beforeEach(() => {
    mockAuthState = { user: { uid: 'seed-uid' } };
    mockGetSeedOwnerUid.mockReturnValue('seed-uid');
  });

  afterEach(() => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
  });

  test('renders the loading screen while useUserTrips is loading', () => {
    mockUseUserTrips.mockReturnValue({ trips: [], status: 'loading' });
    const tree = renderIndex();
    expect(tree?.props.testID).toBe('loading');
  });

  test('0 trips in __DEV__ redirects to the seeded dev trip for the uid that seeded it', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    mockUseUserTrips.mockReturnValue({ trips: [], status: 'ready' });
    const tree = renderIndex();
    expect(tree?.children[0]).toBe('/(trips)/dev-trip-001/(tabs)/jernie');
  });

  // Sign-out and account deletion both land on a fresh anonymous uid, and the seed only ever
  // runs once per device — so that uid cannot read dev-trip-001. Redirecting there stranded
  // the user on an unreadable trip AND hid onboarding, which carries the only sign-in entry
  // point available to someone with no trips.
  test('0 trips in __DEV__ falls through to onboarding when the uid did not seed the dev trip', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    mockAuthState = { user: { uid: 'fresh-anon-uid' } };
    mockUseUserTrips.mockReturnValue({ trips: [], status: 'ready' });
    const tree = renderIndex();
    expect(tree?.children[0]).toBe('/onboarding/step-1');
  });

  test('0 trips in __DEV__ falls through to onboarding when nothing has been seeded yet', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    mockGetSeedOwnerUid.mockReturnValue(null);
    mockUseUserTrips.mockReturnValue({ trips: [], status: 'ready' });
    const tree = renderIndex();
    expect(tree?.children[0]).toBe('/onboarding/step-1');
  });

  test('0 trips in __DEV__ falls through to onboarding before any user has resolved', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    mockAuthState = { user: null };
    mockUseUserTrips.mockReturnValue({ trips: [], status: 'ready' });
    const tree = renderIndex();
    expect(tree?.children[0]).toBe('/onboarding/step-1');
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
