const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@/src/contexts/TripContext', () => ({
  useTripContext: () => ({
    trip: { id: 'trip-xyz', name: 'Maine Coast', inviteToken: 'tok-abc123' },
  }),
}));

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Share } from 'react-native';
import ProfileTab from '@/app/(trips)/[tripId]/(tabs)/profile';

const mockShare = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);

beforeEach(() => {
  mockShare.mockClear();
});

function renderScreen() {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<ProfileTab />); });
  return tree;
}

describe('app/(trips)/[tripId]/(tabs)/profile', () => {
  test('renders the trip invite link', () => {
    const tree = renderScreen();
    expect(JSON.stringify(tree.toJSON())).toContain('jernie://join/tok-abc123');
  });

  test('pressing "Share invite link" shares a message containing the trip name and invite link', () => {
    const tree = renderScreen();
    const shareButton = tree.root.findByProps({ testID: 'share-invite-button' });
    act(() => { shareButton.props.onPress(); });

    expect(mockShare).toHaveBeenCalledTimes(1);
    const shareArg = mockShare.mock.calls[0][0];
    expect(shareArg.message).toContain('Maine Coast');
    expect(shareArg.message).toContain('jernie://join/tok-abc123');
    expect(shareArg.url).toBe('jernie://join/tok-abc123');
  });
});
