const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@/src/contexts/TripContext', () => ({ useTripContext: jest.fn() }));
jest.mock('@/src/hooks/useTripAdmin', () => ({ useTripAdmin: jest.fn() }));
jest.mock('@/src/utils/confirmDelete', () => ({ confirmDelete: jest.fn() }));
jest.mock('@/src/lib/firebase', () => ({ auth: jest.fn() }));

// Auth-context state for the Profile account section / invite gate. Named distinctly from
// `mockAuth` below, which mocks the unrelated `@/src/lib/firebase` auth() getter used for
// the owner check.
let mockAuthState: any;
const mockConfirmAdopt = jest.fn();
jest.mock('@/src/contexts/AuthContext', () => ({ useAuth: () => mockAuthState }));
jest.mock('@/src/lib/collisionPrompt', () => ({
  confirmAdoptExistingAccount: (...a: unknown[]) => mockConfirmAdopt(...a),
}));
jest.mock('@/src/hooks/useUserTrips', () => ({ useUserTrips: () => ({ trips: [], status: 'ready' }) }));

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Share, Text } from 'react-native';
import ProfileTab from '@/app/(trips)/[tripId]/(tabs)/profile';
import { useTripContext } from '@/src/contexts/TripContext';
import { useTripAdmin } from '@/src/hooks/useTripAdmin';
import { confirmDelete } from '@/src/utils/confirmDelete';
import { auth } from '@/src/lib/firebase';

const mockShare = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);

const mockUseTripContext = useTripContext as jest.Mock;
const mockUseTripAdmin = useTripAdmin as jest.Mock;
const mockConfirmDelete = confirmDelete as jest.Mock;
const mockAuth = auth as jest.Mock;

function texts(tree: renderer.ReactTestRenderer): string {
  return tree.root.findAllByType(Text).map(t => {
    const c = t.props.children;
    return Array.isArray(c) ? c.join('') : String(c);
  }).join(' | ');
}

const mockUpdateTrip = jest.fn();
const mockArchiveTrip = jest.fn();
const mockRefetch = jest.fn();

const baseTrip = {
  id: 'trip-xyz',
  name: 'Maine Coast',
  inviteToken: 'tok-abc123',
  ownerUid: 'owner-uid',
};

function setTrip(overrides: Partial<typeof baseTrip> = {}) {
  mockUseTripContext.mockReturnValue({ trip: { ...baseTrip, ...overrides }, refetch: mockRefetch });
}

beforeEach(() => {
  mockShare.mockClear();
  mockReplace.mockClear();
  mockRefetch.mockClear();
  mockConfirmDelete.mockReset();
  mockConfirmAdopt.mockReset();
  mockUpdateTrip.mockReset().mockResolvedValue(undefined);
  mockArchiveTrip.mockReset().mockResolvedValue(undefined);
  mockUseTripAdmin.mockReturnValue({
    updateTrip: mockUpdateTrip,
    archiveTrip: mockArchiveTrip,
    restoreTrip: jest.fn(),
  });
  // Default: current user is the trip owner.
  mockAuth.mockReturnValue({ currentUser: { uid: 'owner-uid' } });
  // Default: already linked, so the pre-existing (non-account-section) tests exercise the
  // invite share path synchronously, as they did before this account section existed.
  mockAuthState = {
    status: 'authenticated',
    user: { uid: 'owner-uid' },
    signInWithApple: jest.fn(),
    signOut: jest.fn(),
    deleteAccount: jest.fn(),
  };
  setTrip();
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

  describe('owner-only trip settings', () => {
    test('owner: trip-name input is pre-filled from trip.name', () => {
      const tree = renderScreen();
      const input = tree.root.findByProps({ testID: 'trip-name-input' });
      expect(input.props.value).toBe('Maine Coast');
    });

    test('owner: editing the name and pressing Save calls updateTrip with the new name, then refetch', async () => {
      const tree = renderScreen();
      const input = tree.root.findByProps({ testID: 'trip-name-input' });
      act(() => { input.props.onChangeText('Acadia Loop'); });

      const saveButton = tree.root.findByProps({ testID: 'save-trip-button' });
      expect(saveButton.props.disabled).toBeFalsy();

      await act(async () => {
        await saveButton.props.onPress();
      });

      expect(mockUpdateTrip).toHaveBeenCalledWith('trip-xyz', { name: 'Acadia Loop' });
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    test('Save is disabled when the name is unchanged, and stays disabled after clearing it to empty', () => {
      const tree = renderScreen();
      const saveButton = tree.root.findByProps({ testID: 'save-trip-button' });
      expect(saveButton.props.disabled).toBe(true); // unchanged from trip.name

      const input = tree.root.findByProps({ testID: 'trip-name-input' });
      act(() => { input.props.onChangeText(''); });
      const saveButtonAfterClear = tree.root.findByProps({ testID: 'save-trip-button' });
      expect(saveButtonAfterClear.props.disabled).toBe(true); // empty
    });

    test('Save disabled state also blocks the write if onPress fires anyway (e.g. unchanged name)', async () => {
      const tree = renderScreen();
      const saveButton = tree.root.findByProps({ testID: 'save-trip-button' });

      await act(async () => {
        await saveButton.props.onPress();
      });

      expect(mockUpdateTrip).not.toHaveBeenCalled();
      expect(mockRefetch).not.toHaveBeenCalled();
    });

    test('if updateTrip rejects, an error is shown and the typed name is preserved (not discarded)', async () => {
      mockUpdateTrip.mockRejectedValue(new Error('network down'));
      const tree = renderScreen();
      const input = tree.root.findByProps({ testID: 'trip-name-input' });
      act(() => { input.props.onChangeText('Acadia Loop'); });

      const saveButton = tree.root.findByProps({ testID: 'save-trip-button' });
      await act(async () => {
        await saveButton.props.onPress();
      });

      expect(mockRefetch).not.toHaveBeenCalled();
      const inputAfter = tree.root.findByProps({ testID: 'trip-name-input' });
      expect(inputAfter.props.value).toBe('Acadia Loop');
      expect(JSON.stringify(tree.toJSON())).toContain("Couldn't save");
    });

    test('non-owner: neither the trip-name input nor the Delete trip button renders', () => {
      mockAuth.mockReturnValue({ currentUser: { uid: 'someone-else-uid' } });
      const tree = renderScreen();

      expect(tree.root.findAllByProps({ testID: 'trip-name-input' })).toHaveLength(0);
      expect(tree.root.findAllByProps({ testID: 'save-trip-button' })).toHaveLength(0);
      expect(tree.root.findAllByProps({ testID: 'delete-trip-button' })).toHaveLength(0);
    });

    test('pressing "Delete trip" calls confirmDelete but does not call archiveTrip until the confirm callback runs', () => {
      const tree = renderScreen();
      const deleteButton = tree.root.findByProps({ testID: 'delete-trip-button' });

      act(() => { deleteButton.props.onPress(); });

      expect(mockConfirmDelete).toHaveBeenCalledTimes(1);
      expect(mockArchiveTrip).not.toHaveBeenCalled();

      const options = mockConfirmDelete.mock.calls[0][0];
      expect(options.title).toBe('Delete trip?');
      expect(options.confirmLabel).toBe('Delete trip');
      expect(options.message).toContain('Maine Coast');
      expect(options.message).toContain('Recently Deleted');
    });

    test('confirming delete calls archiveTrip(tripId) then navigates to /(home) via replace', async () => {
      const tree = renderScreen();
      const deleteButton = tree.root.findByProps({ testID: 'delete-trip-button' });

      act(() => { deleteButton.props.onPress(); });
      const { onConfirm } = mockConfirmDelete.mock.calls[0][0];

      await act(async () => {
        onConfirm();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockArchiveTrip).toHaveBeenCalledWith('trip-xyz');
      expect(mockReplace).toHaveBeenCalledWith('/(home)');
    });

    test('if archiveTrip rejects, an error is shown and navigation does not happen', async () => {
      mockArchiveTrip.mockRejectedValue(new Error('permission-denied'));
      const tree = renderScreen();
      const deleteButton = tree.root.findByProps({ testID: 'delete-trip-button' });

      act(() => { deleteButton.props.onPress(); });
      const { onConfirm } = mockConfirmDelete.mock.calls[0][0];

      await act(async () => {
        onConfirm();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockReplace).not.toHaveBeenCalled();
      expect(JSON.stringify(tree.toJSON())).toContain("Couldn't delete");
    });
  });

  describe('Profile account section', () => {
    it('offers sign-in to an anonymous user', () => {
      mockAuthState = { status: 'anonymous', user: { uid: 'u' }, signInWithApple: jest.fn(), signOut: jest.fn(), deleteAccount: jest.fn() };
      const tree = renderScreen();
      expect(tree.root.findAllByProps({ testID: 'profile-signin' }).length).toBeGreaterThan(0);
      expect(tree.root.findAllByProps({ testID: 'profile-signout' })).toHaveLength(0);
    });

    it('shows identity and sign-out once linked', () => {
      mockAuthState = { status: 'authenticated', user: { uid: 'u', email: 'ada@example.com' }, signInWithApple: jest.fn(), signOut: jest.fn(), deleteAccount: jest.fn() };
      const tree = renderScreen();
      expect(texts(tree)).toContain('ada@example.com');
      expect(tree.root.findAllByProps({ testID: 'profile-signout' }).length).toBeGreaterThan(0);
    });

    // The gate protects everyone in the trip, not just the organizer: if an unlinked
    // organizer loses their device, the shared trip is orphaned for all travellers.
    it('blocks the share invite for an anonymous organizer', () => {
      const signIn = jest.fn().mockResolvedValue({ ok: false, reason: 'cancelled' });
      mockAuthState = { status: 'anonymous', user: { uid: 'u' }, signInWithApple: signIn, signOut: jest.fn(), deleteAccount: jest.fn() };
      const tree = renderScreen();
      act(() => { tree.root.findByProps({ testID: 'share-invite-button' }).props.onPress(); });
      expect(mockShare).not.toHaveBeenCalled();
      expect(signIn).toHaveBeenCalled();
    });

    it('warns before abandoning trips on a Profile collision', async () => {
      const signIn = jest.fn().mockResolvedValue(undefined);
      const signInWithApple = jest.fn().mockResolvedValue({
        ok: false, reason: 'credential-already-in-use', signIn,
      });
      mockAuthState = { status: 'anonymous', user: { uid: 'u' }, signInWithApple, signOut: jest.fn(), deleteAccount: jest.fn() };
      mockConfirmAdopt.mockResolvedValue(false);
      const tree = renderScreen();
      await act(async () => { await tree.root.findByProps({ testID: 'share-invite-button' }).props.onPress(); });
      expect(mockConfirmAdopt).toHaveBeenCalled();
      expect(signIn).not.toHaveBeenCalled();
      expect(mockShare).not.toHaveBeenCalled();
    });

    it('shares normally once linked', () => {
      mockAuthState = { status: 'authenticated', user: { uid: 'u' }, signInWithApple: jest.fn(), signOut: jest.fn(), deleteAccount: jest.fn() };
      const tree = renderScreen();
      act(() => { tree.root.findByProps({ testID: 'share-invite-button' }).props.onPress(); });
      expect(mockShare).toHaveBeenCalled();
    });
  });

  // I3: previously nothing navigated after sign-out or account deletion, leaving the user
  // mounted on this trip under a uid that can no longer read it.
  describe('navigation after sign-out / account deletion (I3)', () => {
    it('navigates to / after signing out', async () => {
      const signOut = jest.fn().mockResolvedValue(undefined);
      mockAuthState = { status: 'authenticated', user: { uid: 'u' }, signInWithApple: jest.fn(), signOut, deleteAccount: jest.fn() };
      const tree = renderScreen();
      await act(async () => { await tree.root.findByProps({ testID: 'profile-signout' }).props.onPress(); });
      expect(signOut).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/');
    });

    it('navigates to / after a successful account deletion', async () => {
      const deleteAccount = jest.fn().mockResolvedValue(undefined);
      mockAuthState = { status: 'authenticated', user: { uid: 'u' }, signInWithApple: jest.fn(), signOut: jest.fn(), deleteAccount };
      const tree = renderScreen();
      act(() => { tree.root.findByProps({ testID: 'profile-delete-account' }).props.onPress(); });
      const { onConfirm } = mockConfirmDelete.mock.calls[0][0];
      await act(async () => {
        onConfirm();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(deleteAccount).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/');
    });

    it('does not navigate when account deletion fails, and shows an error', async () => {
      const deleteAccount = jest.fn().mockRejectedValue(new Error('boom'));
      mockAuthState = { status: 'authenticated', user: { uid: 'u' }, signInWithApple: jest.fn(), signOut: jest.fn(), deleteAccount };
      const tree = renderScreen();
      act(() => { tree.root.findByProps({ testID: 'profile-delete-account' }).props.onPress(); });
      const { onConfirm } = mockConfirmDelete.mock.calls[0][0];
      await act(async () => {
        onConfirm();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(mockReplace).not.toHaveBeenCalled();
      expect(texts(tree)).toContain("Couldn't delete your account");
    });
  });

  // The "Sign in with Apple" button previously did `void signInWithApple()`, discarding
  // collision, error and cancellation alike — an anonymous user could never see why nothing
  // happened, and the error state was only rendered inside the authenticated branch.
  describe('Profile sign-in button (all four LinkOutcome branches)', () => {
    it('renders an error for an anonymous user when Sign in with Apple fails', async () => {
      const signInWithApple = jest.fn().mockResolvedValue({ ok: false, reason: 'error', message: 'network down' });
      mockAuthState = { status: 'anonymous', user: { uid: 'u' }, signInWithApple, signOut: jest.fn(), deleteAccount: jest.fn() };
      const tree = renderScreen();
      await act(async () => { await tree.root.findByProps({ testID: 'profile-signin' }).props.onPress(); });
      expect(texts(tree)).toContain('network down');
    });

    it('does nothing and shows no error when the user cancels Sign in with Apple', async () => {
      const signInWithApple = jest.fn().mockResolvedValue({ ok: false, reason: 'cancelled' });
      mockAuthState = { status: 'anonymous', user: { uid: 'u' }, signInWithApple, signOut: jest.fn(), deleteAccount: jest.fn() };
      const tree = renderScreen();
      await act(async () => { await tree.root.findByProps({ testID: 'profile-signin' }).props.onPress(); });
      // Still anonymous (no status flip) and no failure message rendered.
      expect(tree.root.findAllByProps({ testID: 'profile-signout' })).toHaveLength(0);
      expect(texts(tree)).not.toContain('network down');
    });

    it('warns before adopting on a collision from the sign-in button, and signs in on confirm', async () => {
      const signIn = jest.fn().mockResolvedValue(undefined);
      const signInWithApple = jest.fn().mockResolvedValue({ ok: false, reason: 'credential-already-in-use', signIn });
      mockAuthState = { status: 'anonymous', user: { uid: 'u' }, signInWithApple, signOut: jest.fn(), deleteAccount: jest.fn() };
      mockConfirmAdopt.mockResolvedValue(true);
      const tree = renderScreen();
      await act(async () => { await tree.root.findByProps({ testID: 'profile-signin' }).props.onPress(); });
      expect(mockConfirmAdopt).toHaveBeenCalled();
      expect(signIn).toHaveBeenCalled();
      expect(mockShare).not.toHaveBeenCalled();
    });

    it('does not sign in when the user declines the collision warning from the sign-in button', async () => {
      const signIn = jest.fn().mockResolvedValue(undefined);
      const signInWithApple = jest.fn().mockResolvedValue({ ok: false, reason: 'credential-already-in-use', signIn });
      mockAuthState = { status: 'anonymous', user: { uid: 'u' }, signInWithApple, signOut: jest.fn(), deleteAccount: jest.fn() };
      mockConfirmAdopt.mockResolvedValue(false);
      const tree = renderScreen();
      await act(async () => { await tree.root.findByProps({ testID: 'profile-signin' }).props.onPress(); });
      expect(signIn).not.toHaveBeenCalled();
    });
  });
});
