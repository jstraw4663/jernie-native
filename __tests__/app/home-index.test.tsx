jest.mock('@/src/hooks/useUserTrips', () => ({ useUserTrips: jest.fn() }));
jest.mock('@/src/hooks/useTripAdmin', () => ({ useTripAdmin: jest.fn() }));
jest.mock('@/src/features/jernie/TripLoadingScreen', () => ({
  TripLoadingScreen: () => {
    const { Text } = require('react-native');
    return <Text testID="loading">loading</Text>;
  },
}));

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import renderer, { act } from 'react-test-renderer';
import MyTripsScreen from '@/app/(home)/index';
import { useUserTrips } from '@/src/hooks/useUserTrips';
import { useTripAdmin } from '@/src/hooks/useTripAdmin';

const mockUseUserTrips = useUserTrips as jest.Mock;
const mockUseTripAdmin = useTripAdmin as jest.Mock;
const mockRestoreTrip = jest.fn();
const mockRefetch = jest.fn();

function renderScreen() {
  let tree: ReturnType<typeof renderer.create>;
  act(() => {
    tree = renderer.create(<MyTripsScreen />);
  });
  return tree!;
}

describe('app/(home)/index', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockPush.mockClear();
    mockRefetch.mockClear();
    mockRestoreTrip.mockReset();
    mockRestoreTrip.mockResolvedValue(undefined);
    mockUseTripAdmin.mockReturnValue({
      updateTrip: jest.fn(),
      archiveTrip: jest.fn(),
      restoreTrip: mockRestoreTrip,
    });
  });

  test('renders the loading screen while useUserTrips is loading', () => {
    mockUseUserTrips.mockReturnValue({ trips: [], status: 'loading', refetch: mockRefetch });
    const tree = renderScreen();
    const loading = tree.root.findByProps({ testID: 'loading' });
    expect(loading).toBeTruthy();
  });

  test('renders an empty state with 0 trips', () => {
    mockUseUserTrips.mockReturnValue({ trips: [], status: 'ready', refetch: mockRefetch });
    const tree = renderScreen();
    expect(tree.root.findAllByProps({ testID: 'trip-row-trip-a' })).toHaveLength(0);
    expect(JSON.stringify(tree.toJSON())).toContain("haven't joined any trips");
  });

  test('renders one row per trip and navigates to the trip on press using replace (not push, so the previous trip screen actually unmounts)', () => {
    mockUseUserTrips.mockReturnValue({
      trips: [
        { tripId: 'trip-a', role: 'organizer', joinedAt: 1, name: 'Trip A', deletedAt: null },
        { tripId: 'trip-b', role: 'traveler', joinedAt: 2, name: 'Trip B', deletedAt: null },
      ],
      status: 'ready',
      refetch: mockRefetch,
    });
    const tree = renderScreen();
    const rowA = tree.root.findByProps({ testID: 'trip-row-trip-a' });
    expect(tree.root.findByProps({ testID: 'trip-row-trip-b' })).toBeTruthy();

    act(() => {
      rowA.props.onPress();
    });
    expect(mockReplace).toHaveBeenCalledWith('/(trips)/trip-a/(tabs)/jernie');
  });

  test('"Create New Trip" navigates to the onboarding wizard', () => {
    mockUseUserTrips.mockReturnValue({ trips: [], status: 'ready', refetch: mockRefetch });
    const tree = renderScreen();
    const createButton = tree.root.findByProps({ testID: 'create-trip-button' });

    act(() => {
      createButton.props.onPress();
    });
    expect(mockPush).toHaveBeenCalledWith('/onboarding/step-1');
  });

  test('renders the trip name (not the id) as the row title', () => {
    mockUseUserTrips.mockReturnValue({
      trips: [{ tripId: 'trip-a', role: 'organizer', joinedAt: 1, name: 'Amalfi Coast', deletedAt: null }],
      status: 'ready',
      refetch: mockRefetch,
    });
    const tree = renderScreen();
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Amalfi Coast');
    expect(json).not.toContain('"trip-a"');
  });

  test('an archived trip is excluded from the main list, empty-state copy keys off the active count, and a Recently Deleted section lists it with a working Restore button', async () => {
    mockUseUserTrips.mockReturnValue({
      trips: [
        { tripId: 'trip-active', role: 'organizer', joinedAt: 1, name: 'Active Trip', deletedAt: null },
        { tripId: 'trip-gone', role: 'organizer', joinedAt: 2, name: 'Archived Trip', deletedAt: 1700000000000 },
      ],
      status: 'ready',
      refetch: mockRefetch,
    });
    const tree = renderScreen();

    // Archived trip does not appear as a normal, navigable row.
    expect(tree.root.findAllByProps({ testID: 'trip-row-trip-gone' })).toHaveLength(0);
    // With one active trip present, the "no trips" empty-state copy must not show.
    expect(JSON.stringify(tree.toJSON())).not.toContain("haven't joined any trips");

    expect(JSON.stringify(tree.toJSON())).toContain('Recently Deleted');
    const restoreButton = tree.root.findByProps({ testID: 'restore-trip-trip-gone' });
    expect(restoreButton).toBeTruthy();

    await act(async () => {
      await restoreButton.props.onPress();
    });
    expect(mockRestoreTrip).toHaveBeenCalledWith('trip-gone');
  });

  test('Restore refreshes the list only after the write resolves, since restoreTrip touches only trips/{tripId} and never re-fires the index listener useUserTrips relies on', async () => {
    let resolveRestore: () => void = () => {};
    mockRestoreTrip.mockImplementation(() => new Promise<void>(resolve => { resolveRestore = resolve; }));
    mockUseUserTrips.mockReturnValue({
      trips: [{ tripId: 'trip-gone', role: 'organizer', joinedAt: 1, name: 'Archived Trip', deletedAt: 1700000000000 }],
      status: 'ready',
      refetch: mockRefetch,
    });
    const tree = renderScreen();
    const restoreButton = tree.root.findByProps({ testID: 'restore-trip-trip-gone' });

    let pressPromise: Promise<void> = Promise.resolve();
    act(() => {
      pressPromise = restoreButton.props.onPress();
    });

    // The write is in flight (not yet resolved) — refetch must not have fired yet.
    expect(mockRestoreTrip).toHaveBeenCalledWith('trip-gone');
    expect(mockRefetch).not.toHaveBeenCalled();

    await act(async () => {
      resolveRestore();
      await pressPromise;
    });

    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  test('does not render a Recently Deleted section when there are no archived trips', () => {
    mockUseUserTrips.mockReturnValue({
      trips: [{ tripId: 'trip-active', role: 'organizer', joinedAt: 1, name: 'Active Trip', deletedAt: null }],
      status: 'ready',
      refetch: mockRefetch,
    });
    const tree = renderScreen();
    expect(JSON.stringify(tree.toJSON())).not.toContain('Recently Deleted');
  });

  test('empty-state copy shows when every trip is archived (active count is 0)', () => {
    mockUseUserTrips.mockReturnValue({
      trips: [{ tripId: 'trip-gone', role: 'organizer', joinedAt: 1, name: 'Archived Trip', deletedAt: 1700000000000 }],
      status: 'ready',
      refetch: mockRefetch,
    });
    const tree = renderScreen();
    expect(JSON.stringify(tree.toJSON())).toContain("haven't joined any trips");
  });
});
