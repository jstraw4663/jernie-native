const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@/src/contexts/TripContext', () => ({ useTripContext: jest.fn() }));
jest.mock('@/src/hooks/useTripAdmin', () => ({ useTripAdmin: jest.fn() }));
jest.mock('@/src/utils/confirmDelete', () => ({ confirmDelete: jest.fn() }));

// Auth-context state for the Profile account section, invite gate, and (T-minor) the owner
// check — profile.tsx used to read auth().currentUser?.uid directly for isOwner, which was
// non-reactive; it now reads the same `user` from useAuth() as everything else on screen.
let mockAuthState: any;
jest.mock('@/src/contexts/AuthContext', () => ({ useAuth: () => mockAuthState }));
// The trust gate, the three-way prompt and the trip copy all live in useCollisionSignIn and
// are covered by __tests__/useCollisionSignIn.test.tsx. What this screen owns is delegating
// to it and mapping each outcome onto the right UI.
const mockAdoptOnCollision = jest.fn();
jest.mock('@/src/hooks/useCollisionSignIn', () => ({
  useCollisionSignIn: () => mockAdoptOnCollision,
}));
// I4: mutable per-test, not a static { trips: [], status: 'ready' } — that shape hid I4
// entirely, since it can never report 'loading' or 'error'.
let mockUserTripsState: { trips: unknown[]; status: 'loading' | 'ready' | 'error' };
jest.mock('@/src/hooks/useUserTrips', () => ({ useUserTrips: () => mockUserTripsState }));

// The screen now also composes the cache card, the traveller rail and the admin panel.
// These are mocked rather than imported for real: ConnectivityContext and AdminPanel both
// reach react-native-mmkv -> NitroModules, which has no native binary under jest.
jest.mock('@/src/contexts/ConnectivityContext', () => ({
  useConnectivityState: () => ({ isOnline: true, wasOffline: false, pendingWriteCount: 0 }),
}));
jest.mock('@/src/contexts/AdminUnlockContext', () => ({
  useAdminUnlock: () => ({ unlocked: false, registerTabPress: jest.fn(), lock: jest.fn() }),
}));
jest.mock('@/src/features/jernie/profile/AdminPanel', () => ({ AdminPanel: () => null }));
jest.mock('@/src/utils/devTime', () => ({ getDevNow: () => new Date('2026-07-11T12:00:00Z') }));
let mockProfileState: { displayName: string | null; email: string | null; plan: string | undefined; status: string; refetch: jest.Mock };
jest.mock('@/src/hooks/useUserProfile', () => ({ useUserProfile: () => mockProfileState }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
// Reaches src/lib/firebase, which pulls the whole @react-native-firebase stack.
const mockUpdateDisplayName = jest.fn();
jest.mock('@/src/lib/userProfile', () => ({ updateDisplayName: (...args: unknown[]) => mockUpdateDisplayName(...args) }));
// The sheets are @gorhom BottomSheetModals; they need a modal provider that this renderer
// has no reason to set up, and their behaviour is not what this suite is about.
jest.mock('@/src/features/jernie/sheets/MemberSheet', () => ({ MemberSheet: () => null }));
jest.mock('@/src/features/jernie/sheets/FeedbackSheet', () => ({ FeedbackSheet: () => null }));

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Share, Text } from 'react-native';
import ProfileTab from '@/app/(trips)/[tripId]/(tabs)/profile';
import { useTripContext } from '@/src/contexts/TripContext';
import { useTripAdmin } from '@/src/hooks/useTripAdmin';
import { confirmDelete } from '@/src/utils/confirmDelete';

const mockShare = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);

const mockUseTripContext = useTripContext as jest.Mock;
const mockUseTripAdmin = useTripAdmin as jest.Mock;
const mockConfirmDelete = confirmDelete as jest.Mock;

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
  mockUseTripContext.mockReturnValue({
    trip: { ...baseTrip, ...overrides },
    stops: [{ id: 'stop-1', city: 'Portland', color: '#2C5880', dates: { start: '2026-07-10', end: '2026-07-12' } }],
    members: [{ uid: 'owner-uid', handle: 'Jeremy', role: 'organizer', joinedAt: 0 }],
    groups: [],
    currentUid: 'owner-uid',
    places: [],
    enrichment: {},
    fromCache: false,
    cachedAt: null,
    status: 'ready',
    refetch: mockRefetch,
  });
}

beforeEach(() => {
  mockShare.mockClear();
  mockReplace.mockClear();
  mockRefetch.mockClear();
  mockConfirmDelete.mockReset();
  mockAdoptOnCollision.mockReset().mockResolvedValue({ status: 'signed-in', failed: 0 });
  mockUserTripsState = { trips: [], status: 'ready' };
  mockProfileState = { displayName: 'Jeremy', email: 'j@example.com', plan: 'free', status: 'ready', refetch: jest.fn() };
  mockUpdateTrip.mockReset().mockResolvedValue(undefined);
  mockArchiveTrip.mockReset().mockResolvedValue(undefined);
  mockUseTripAdmin.mockReturnValue({
    updateTrip: mockUpdateTrip,
    archiveTrip: mockArchiveTrip,
    restoreTrip: jest.fn(),
  });
  // Default: already linked and the current user is the trip owner, so the pre-existing
  // (non-account-section) tests exercise the invite share path synchronously, as they did
  // before this account section existed.
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
      mockAuthState = { ...mockAuthState, user: { uid: 'someone-else-uid' } };
      const tree = renderScreen();

      expect(tree.root.findAllByProps({ testID: 'trip-name-input' })).toHaveLength(0);
      expect(tree.root.findAllByProps({ testID: 'save-trip-button' })).toHaveLength(0);
      expect(tree.root.findAllByProps({ testID: 'delete-trip-button' })).toHaveLength(0);
    });

    // T-minor: isOwner used to read auth().currentUser?.uid directly instead of the `user`
    // already available from useAuth() on this screen — a non-reactive read that could show
    // stale owner controls (or hide real ones) independently of everything else the screen
    // renders off auth state. Sourcing it from the same `user` means it updates in lockstep.
    test('owner-only controls react immediately to the uid changing underneath, without a remount', () => {
      const tree = renderScreen();
      expect(tree.root.findAllByProps({ testID: 'trip-name-input' }).length).toBeGreaterThan(0);

      mockAuthState = { ...mockAuthState, user: { uid: 'someone-else-uid' } };
      act(() => { tree.update(<ProfileTab />); });
      expect(tree.root.findAllByProps({ testID: 'trip-name-input' })).toHaveLength(0);
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

    it('hands a share-invite collision to the collision flow rather than sharing', async () => {
      const signIn = jest.fn().mockResolvedValue(undefined);
      const signInWithApple = jest.fn().mockResolvedValue({
        ok: false, reason: 'credential-already-in-use', signIn,
      });
      mockAuthState = { status: 'anonymous', user: { uid: 'u' }, signInWithApple, signOut: jest.fn(), deleteAccount: jest.fn() };
      mockAdoptOnCollision.mockResolvedValue({ status: 'cancelled' });
      const tree = renderScreen();
      await act(async () => { await tree.root.findByProps({ testID: 'share-invite-button' }).props.onPress(); });
      expect(mockAdoptOnCollision).toHaveBeenCalledWith(signIn);
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
    // One shared `error` state fed both the Account block and the trip-settings block, so a
    // failed sign-in printed "Couldn't sign in. Try again." twice on screen — once under
    // Account and again under Save.
    it('renders a sign-in failure exactly once, not also under the trip-settings block', async () => {
      // uid matches baseTrip.ownerUid so the owner-only trip-settings block renders too —
      // that is the block the error was leaking into.
      mockAuthState = {
        status: 'anonymous',
        user: { uid: 'owner-uid' },
        signInWithApple: jest.fn().mockResolvedValue({ ok: false, reason: 'error', message: 'Apple is down' }),
        signOut: jest.fn(),
        deleteAccount: jest.fn(),
      };
      const tree = renderScreen();
      expect(tree.root.findAllByProps({ testID: 'save-trip-button' }).length).toBeGreaterThan(0);
      await act(async () => { await tree.root.findByProps({ testID: 'profile-signin' }).props.onPress(); });

      const occurrences = tree.root.findAllByType(Text)
        .filter((t: { props: { children: unknown } }) => String(t.props.children) === 'Apple is down');
      expect(occurrences).toHaveLength(1);
    });

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

    it('routes a sign-in-button collision through the collision flow', async () => {
      const signIn = jest.fn().mockResolvedValue(undefined);
      const signInWithApple = jest.fn().mockResolvedValue({ ok: false, reason: 'credential-already-in-use', signIn });
      mockAuthState = { status: 'anonymous', user: { uid: 'u' }, signInWithApple, signOut: jest.fn(), deleteAccount: jest.fn() };
      const tree = renderScreen();
      await act(async () => { await tree.root.findByProps({ testID: 'profile-signin' }).props.onPress(); });
      expect(mockAdoptOnCollision).toHaveBeenCalledWith(signIn);
      expect(mockShare).not.toHaveBeenCalled();
    });

    // The sign-in landed; only the copy is outstanding, so this must not read as a failure.
    it('says the trip is still copying when the sign-in succeeded but a copy did not', async () => {
      const signInWithApple = jest.fn().mockResolvedValue({
        ok: false, reason: 'credential-already-in-use', signIn: jest.fn(),
      });
      mockAuthState = { status: 'anonymous', user: { uid: 'u' }, signInWithApple, signOut: jest.fn(), deleteAccount: jest.fn() };
      mockAdoptOnCollision.mockResolvedValue({ status: 'signed-in', failed: 1 });
      const tree = renderScreen();
      await act(async () => { await tree.root.findByProps({ testID: 'profile-signin' }).props.onPress(); });
      expect(texts(tree)).toContain('still copying across');
      expect(texts(tree)).not.toContain("Couldn't sign in");
    });
  });

  // I4: useUserTrips() reports 'loading'/'error' with an empty trips array, which would
  // otherwise be read as "nothing to lose" and adopt silently with no warning.
  describe('collision gate refuses to adopt on an untrustworthy trip count (I4)', () => {
    it('sign-in button: refuses to adopt and shows an error while trips are still loading', async () => {
      const signIn = jest.fn().mockResolvedValue(undefined);
      const signInWithApple = jest.fn().mockResolvedValue({ ok: false, reason: 'credential-already-in-use', signIn });
      mockAuthState = { status: 'anonymous', user: { uid: 'u' }, signInWithApple, signOut: jest.fn(), deleteAccount: jest.fn() };
      mockAdoptOnCollision.mockResolvedValue({ status: 'untrusted' });
      const tree = renderScreen();
      await act(async () => { await tree.root.findByProps({ testID: 'profile-signin' }).props.onPress(); });
      expect(signIn).not.toHaveBeenCalled();
      expect(texts(tree)).toContain("Can't verify your trips");
    });

    it('sign-in button: refuses to adopt when the trip count failed to load', async () => {
      const signIn = jest.fn().mockResolvedValue(undefined);
      const signInWithApple = jest.fn().mockResolvedValue({ ok: false, reason: 'credential-already-in-use', signIn });
      mockAuthState = { status: 'anonymous', user: { uid: 'u' }, signInWithApple, signOut: jest.fn(), deleteAccount: jest.fn() };
      mockAdoptOnCollision.mockResolvedValue({ status: 'untrusted' });
      const tree = renderScreen();
      await act(async () => { await tree.root.findByProps({ testID: 'profile-signin' }).props.onPress(); });
      expect(signIn).not.toHaveBeenCalled();
      expect(texts(tree)).toContain("Can't verify your trips");
    });

    it('share-invite button: refuses to adopt while trips are still loading', async () => {
      const signIn = jest.fn().mockResolvedValue(undefined);
      const signInWithApple = jest.fn().mockResolvedValue({ ok: false, reason: 'credential-already-in-use', signIn });
      mockAuthState = { status: 'anonymous', user: { uid: 'u' }, signInWithApple, signOut: jest.fn(), deleteAccount: jest.fn() };
      mockAdoptOnCollision.mockResolvedValue({ status: 'untrusted' });
      const tree = renderScreen();
      await act(async () => { await tree.root.findByProps({ testID: 'share-invite-button' }).props.onPress(); });
      expect(signIn).not.toHaveBeenCalled();
      expect(texts(tree)).toContain("Can't verify your trips");
      expect(mockShare).not.toHaveBeenCalled();
    });
  });

  // T-minor: `await outcome.signIn()` was unguarded (a rejection escaped the async
  // onPress), and on success execution fell through to Share.share for a trip the newly
  // adopted uid no longer owns.
  describe('collision-adopt sign-in is guarded and never falls through to Share.share', () => {
    it('sign-in button: a rejected adopt sign-in surfaces an error instead of an unhandled rejection', async () => {
      const signInWithApple = jest.fn().mockResolvedValue({
        ok: false, reason: 'credential-already-in-use', signIn: jest.fn(),
      });
      mockAuthState = { status: 'anonymous', user: { uid: 'u' }, signInWithApple, signOut: jest.fn(), deleteAccount: jest.fn() };
      mockAdoptOnCollision.mockResolvedValue({ status: 'failed' });
      const tree = renderScreen();
      await act(async () => { await tree.root.findByProps({ testID: 'profile-signin' }).props.onPress(); });
      expect(texts(tree)).toContain("Couldn't sign in");
    });

    it('share-invite button: a rejected adopt sign-in surfaces an error and never shares', async () => {
      const signInWithApple = jest.fn().mockResolvedValue({
        ok: false, reason: 'credential-already-in-use', signIn: jest.fn(),
      });
      mockAuthState = { status: 'anonymous', user: { uid: 'u' }, signInWithApple, signOut: jest.fn(), deleteAccount: jest.fn() };
      mockAdoptOnCollision.mockResolvedValue({ status: 'failed' });
      const tree = renderScreen();
      await act(async () => { await tree.root.findByProps({ testID: 'share-invite-button' }).props.onPress(); });
      expect(texts(tree)).toContain("Couldn't sign in");
      expect(mockShare).not.toHaveBeenCalled();
    });

    // Even when the trip is carried across, the copy has a new id and a new invite token, so
    // the link rendered on this screen is stale either way.
    it('share-invite button: a successful collision sign-in never falls through to sharing this trip', async () => {
      const signIn = jest.fn().mockResolvedValue(undefined);
      const signInWithApple = jest.fn().mockResolvedValue({ ok: false, reason: 'credential-already-in-use', signIn });
      mockAuthState = { status: 'anonymous', user: { uid: 'u' }, signInWithApple, signOut: jest.fn(), deleteAccount: jest.fn() };
      mockAdoptOnCollision.mockResolvedValue({ status: 'signed-in', failed: 0 });
      const tree = renderScreen();
      await act(async () => { await tree.root.findByProps({ testID: 'share-invite-button' }).props.onPress(); });
      expect(mockAdoptOnCollision).toHaveBeenCalledWith(signIn);
      expect(mockShare).not.toHaveBeenCalled();
    });
  });
});

describe('Profile — You card', () => {
  it('shows the display name from users/{uid}, not the join-time member handle', () => {
    // The handle is denormalized at join and write-once by rule, so renaming can only ever
    // change displayName. Showing the handle here would make Edit look broken.
    mockProfileState = { displayName: 'Ada Lovelace', email: null, plan: 'free', status: 'ready', refetch: jest.fn() };
    expect(texts(renderScreen())).toContain('Ada Lovelace');
  });

  it('falls back to the member handle when the profile read has not landed', () => {
    mockProfileState = { displayName: null, email: null, plan: undefined, status: 'loading', refetch: jest.fn() };
    expect(texts(renderScreen())).toContain('Jeremy');
  });

  it('shows the role from the member record', () => {
    expect(texts(renderScreen())).toContain('Organizer');
  });

  it('badges an anonymous user as a guest and a linked one as free', () => {
    mockProfileState = { displayName: 'Jeremy', email: null, plan: 'anonymous', status: 'ready', refetch: jest.fn() };
    expect(texts(renderScreen())).toContain('Guest');
    mockProfileState = { displayName: 'Jeremy', email: null, plan: 'free', status: 'ready', refetch: jest.fn() };
    expect(texts(renderScreen())).toContain('Free');
  });

  it('offers rename only once signed in', () => {
    // An anonymous account is thrown away with the device. Inviting someone to personalise
    // it before they sign in is inviting them to lose the effort.
    expect(renderScreen().root.findAllByProps({ testID: 'display-name-edit' }).length).toBeGreaterThan(0);

    mockAuthState = { ...mockAuthState, status: 'anonymous' };
    expect(renderScreen().root.findAllByProps({ testID: 'display-name-edit' }).length).toBe(0);
  });

  it('writes the new name and refetches the profile', async () => {
    const refetch = jest.fn();
    mockProfileState = { displayName: 'Jeremy', email: null, plan: 'free', status: 'ready', refetch };
    mockUpdateDisplayName.mockReset().mockResolvedValue(undefined);
    const tree = renderScreen();

    act(() => { tree.root.findByProps({ testID: 'display-name-edit' }).props.onPress(); });
    act(() => { tree.root.findByProps({ testID: 'display-name-input' }).props.onChangeText('Ada'); });
    await act(async () => { await tree.root.findByProps({ testID: 'display-name-save' }).props.onPress(); });

    expect(mockUpdateDisplayName).toHaveBeenCalledWith('owner-uid', 'Ada');
    expect(refetch).toHaveBeenCalled();
  });

  it('keeps the editor open with the typed name when the rename fails', async () => {
    mockUpdateDisplayName.mockReset().mockRejectedValue(new Error('offline'));
    const tree = renderScreen();
    act(() => { tree.root.findByProps({ testID: 'display-name-edit' }).props.onPress(); });
    act(() => { tree.root.findByProps({ testID: 'display-name-input' }).props.onChangeText('Ada'); });
    await act(async () => { await tree.root.findByProps({ testID: 'display-name-save' }).props.onPress(); });

    // Dismissing on failure discards what they typed and looks identical to succeeding.
    expect(tree.root.findByProps({ testID: 'display-name-input' }).props.value).toBe('Ada');
    expect(texts(tree)).toContain("Couldn't save that name. Try again.");
  });
});

describe('Profile — traveller rail and cache card', () => {
  it('labels the only member as "Just you so far" rather than "1 travellers"', () => {
    expect(texts(renderScreen())).toContain('Just you so far');
  });

  it('marks the current user as You and names everyone else', () => {
    mockUseTripContext.mockReturnValue({
      ...mockUseTripContext(),
      members: [
        { uid: 'owner-uid', handle: 'Jeremy', role: 'organizer', joinedAt: 0 },
        { uid: 'friend', handle: 'Sam', role: 'traveler', joinedAt: 0 },
      ],
    });
    const out = texts(renderScreen());
    expect(out).toContain('You');
    expect(out).toContain('Sam');
    expect(out).toContain('2 travellers');
  });

  it('reports live trip data when reading straight from RTDB', () => {
    expect(texts(renderScreen())).toContain('Trip data');
    expect(texts(renderScreen())).toContain('Live');
  });

  it('says everything is saved when the write queue is empty', () => {
    expect(texts(renderScreen())).toContain('Everything saved');
  });
});

describe('Profile — version row', () => {
  it('shows the build label in every build, not only __DEV__', () => {
    // It is what a tester reads off this screen to say which code they were running, so
    // hiding it in release builds hid it from the only people who needed it.
    expect(texts(renderScreen())).toContain('auth-durability');
  });

  it('offers a way into the feedback sheet', () => {
    expect(renderScreen().root.findAllByProps({ testID: 'open-feedback' }).length).toBeGreaterThan(0);
  });
});
