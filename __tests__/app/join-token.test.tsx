const mockReplace = jest.fn();
let mockToken: string | undefined = 'abc123';
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ token: mockToken }),
  useRouter: () => ({ replace: mockReplace }),
}));

const mockJoinTrip = jest.fn();
let mockStatus: 'idle' | 'joining' | 'success' | 'error' = 'idle';
let mockError: Error | null = null;
jest.mock('@/src/hooks/useJoinTrip', () => ({
  useJoinTrip: () => ({ joinTrip: mockJoinTrip, status: mockStatus, error: mockError }),
}));

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { TextInput, TouchableOpacity } from 'react-native';
import JoinTripScreen, { joinErrorMessage } from '@/app/join/[token]';

function renderScreen() {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<JoinTripScreen />); });
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockToken = 'abc123';
  mockStatus = 'idle';
  mockError = null;
});

describe('app/join/[token]', () => {
  test('renders a name input and join button in idle state', () => {
    const tree = renderScreen();
    expect(tree.root.findByType(TextInput)).toBeTruthy();
    expect(JSON.stringify(tree.toJSON())).toContain('Join trip');
  });

  test('typing a name and pressing join calls joinTrip with the token and typed name', async () => {
    mockJoinTrip.mockResolvedValue({ tripId: 'trip-xyz' });
    const tree = renderScreen();

    act(() => {
      tree.root.findByType(TextInput).props.onChangeText('Jennie');
    });
    await act(async () => {
      await tree.root.findByType(TouchableOpacity).props.onPress();
    });

    expect(mockJoinTrip).toHaveBeenCalledWith('abc123', 'Jennie');
  });

  test('on success, redirects into the joined trip via router.replace', async () => {
    mockJoinTrip.mockResolvedValue({ tripId: 'trip-xyz' });
    const tree = renderScreen();

    await act(async () => {
      await tree.root.findByType(TouchableOpacity).props.onPress();
    });

    expect(mockReplace).toHaveBeenCalledWith('/(trips)/trip-xyz/(tabs)/jernie');
  });

  test('shows a friendly message for an invalid invite token', () => {
    mockStatus = 'error';
    mockError = new Error('invite token not found');
    const tree = renderScreen();
    expect(JSON.stringify(tree.toJSON())).toContain("isn't valid");
  });

  test('shows an already-a-member/invalid-link message for a permission-denied rejection', () => {
    mockStatus = 'error';
    mockError = Object.assign(new Error('permission denied'), { code: 'database/permission-denied' });
    const tree = renderScreen();
    expect(JSON.stringify(tree.toJSON())).toContain('already be a member');
  });

  test('shows the raw error message for any other kind of failure', () => {
    mockStatus = 'error';
    mockError = new Error('network hiccup');
    const tree = renderScreen();
    expect(JSON.stringify(tree.toJSON())).toContain("Couldn't join the trip: network hiccup");
  });

  test('disables the join button and shows a spinner while joining', () => {
    mockStatus = 'joining';
    const tree = renderScreen();
    const button = tree.root.findByType(TouchableOpacity);
    expect(button.props.disabled).toBe(true);
    expect(tree.root.findAllByProps({ children: 'Join trip' })).toHaveLength(0);
  });

  test('shows a fallback screen when the token param is missing', () => {
    mockToken = undefined;
    const tree = renderScreen();
    expect(JSON.stringify(tree.toJSON())).toContain('Invalid invite link');
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  });
});

describe('joinErrorMessage', () => {
  test('null error produces an empty string', () => {
    expect(joinErrorMessage(null)).toBe('');
  });

  test('"invite token not found" gets the invalid-link message', () => {
    expect(joinErrorMessage(new Error('invite token not found'))).toContain("isn't valid");
  });

  test('a permission-denied code gets the already-a-member/invalid-link message', () => {
    const err = Object.assign(new Error('permission denied'), { code: 'database/permission-denied' });
    expect(joinErrorMessage(err)).toContain('already be a member');
  });

  test('any other error surfaces its raw message', () => {
    expect(joinErrorMessage(new Error('network hiccup'))).toBe("Couldn't join the trip: network hiccup");
  });
});
