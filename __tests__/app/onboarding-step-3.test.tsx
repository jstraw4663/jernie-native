const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockSignInWithApple = jest.fn();
const mockAdoptOnCollision = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace }) }));
// I6: mutable per-test, not a static { status: 'anonymous', ... } — that shape made it
// impossible for a test to ever exercise the authenticated branch.
let mockAuthState: { status: string; user: { uid: string; email?: string; displayName?: string } | null; signInWithApple: jest.Mock };
jest.mock('@/src/contexts/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));
jest.mock('@/src/contexts/OnboardingDraftContext', () => ({
  useOnboardingDraft: () => ({
    draft: {
      name: 'Maine Summer 2026',
      colorPack: { id: 'p', stopColors: ['#2C5880'], heroGradient: ['#111111', '#222222'] },
    },
  }),
}));
// The trust gate, the three-way prompt and the trip copy live in useCollisionSignIn
// (__tests__/useCollisionSignIn.test.tsx). This screen owns delegating to it and mapping each
// outcome onto navigation or an error.
jest.mock('@/src/hooks/useCollisionSignIn', () => ({
  useCollisionSignIn: () => mockAdoptOnCollision,
}));

// The trip-count query behind the C3/I4 collision gate — a user who already owns trips can
// reach step 3 via "Create New Trip" from My Trips, so the silent-adopt path must be earned.
let mockUserTripsState: { trips: unknown[]; status: 'loading' | 'ready' | 'error' };
jest.mock('@/src/hooks/useUserTrips', () => ({
  useUserTrips: () => mockUserTripsState,
}));

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import Step3 from '@/app/onboarding/step-3';

function render() {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<Step3 />); });
  return tree;
}
function texts(tree: renderer.ReactTestRenderer): string {
  return tree.root.findAllByType(Text).map(t => {
    const c = t.props.children;
    return Array.isArray(c) ? c.join('') : String(c);
  }).join(' | ');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAdoptOnCollision.mockReset().mockResolvedValue({ status: 'signed-in', failed: 0 });
  mockUserTripsState = { trips: [], status: 'ready' };
  mockAuthState = { status: 'anonymous', user: { uid: 'u' }, signInWithApple: mockSignInWithApple };
});

describe('Onboarding step 3', () => {
  it('previews the trip name from the draft', () => {
    expect(texts(render())).toContain('Maine Summer 2026');
  });

  it('advances to step 4 after a successful link', async () => {
    mockSignInWithApple.mockResolvedValue({ ok: true, user: { uid: 'u' } });
    const tree = render();
    await act(async () => { await tree.root.findByProps({ testID: 'step3-apple-button' }).props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith('/onboarding/step-4');
  });

  // Skipping is supported — the save nudge and invite gate carry the user from here.
  it('advances to step 4 when the user skips', () => {
    const tree = render();
    act(() => { tree.root.findByProps({ testID: 'step3-skip' }).props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith('/onboarding/step-4');
  });

  it('stays put and says nothing when the user cancels the Apple sheet', async () => {
    mockSignInWithApple.mockResolvedValue({ ok: false, reason: 'cancelled' });
    const tree = render();
    await act(async () => { await tree.root.findByProps({ testID: 'step3-apple-button' }).props.onPress(); });
    expect(mockPush).not.toHaveBeenCalled();
    expect(texts(tree)).not.toContain('again');
  });

  it('surfaces an error without leaving the screen', async () => {
    mockSignInWithApple.mockResolvedValue({ ok: false, reason: 'error', message: 'network down' });
    const tree = render();
    await act(async () => { await tree.root.findByProps({ testID: 'step3-apple-button' }).props.onPress(); });
    expect(mockPush).not.toHaveBeenCalled();
    expect(texts(tree)).toContain('network down');
  });

  describe('collision handling (credential-already-in-use)', () => {
    // A genuine first-run user reaching step 3 the normal way owns nothing yet, so the prompt
    // is skipped and this reads as an ordinary sign-in.
    it('hands the collision to the collision flow and continues once it signs in', async () => {
      const signIn = jest.fn().mockResolvedValue(undefined);
      mockSignInWithApple.mockResolvedValue({ ok: false, reason: 'credential-already-in-use', signIn });
      const tree = render();
      await act(async () => { await tree.root.findByProps({ testID: 'step3-apple-button' }).props.onPress(); });
      expect(mockAdoptOnCollision).toHaveBeenCalledWith(signIn);
      expect(mockPush).toHaveBeenCalledWith('/onboarding/step-4');
    });

    // "Create New Trip" from My Trips (app/(home)/index.tsx) routes here too, so a user who
    // already owns trips can reach this screen and be offered the choice.
    it('does not navigate when the user backs out of the collision prompt', async () => {
      mockSignInWithApple.mockResolvedValue({
        ok: false, reason: 'credential-already-in-use', signIn: jest.fn(),
      });
      mockAdoptOnCollision.mockResolvedValue({ status: 'cancelled' });
      const tree = render();
      await act(async () => { await tree.root.findByProps({ testID: 'step3-apple-button' }).props.onPress(); });
      expect(mockPush).not.toHaveBeenCalled();
      expect(texts(tree)).not.toContain("Couldn't sign in");
    });

    it('refuses and does not navigate while the owned-trip count cannot be trusted', async () => {
      mockSignInWithApple.mockResolvedValue({
        ok: false, reason: 'credential-already-in-use', signIn: jest.fn(),
      });
      mockAdoptOnCollision.mockResolvedValue({ status: 'untrusted' });
      const tree = render();
      await act(async () => { await tree.root.findByProps({ testID: 'step3-apple-button' }).props.onPress(); });
      expect(mockPush).not.toHaveBeenCalled();
      expect(texts(tree)).toContain("Can't verify your trips");
    });

    // T8 (deferred at the original spec): a failure inside the collision branch must surface
    // an error and must not navigate — abandoning the uid can fail partway.
    it('surfaces an error and does not navigate when the collision sign-in fails', async () => {
      mockSignInWithApple.mockResolvedValue({
        ok: false, reason: 'credential-already-in-use', signIn: jest.fn(),
      });
      mockAdoptOnCollision.mockResolvedValue({ status: 'failed' });
      const tree = render();
      await act(async () => { await tree.root.findByProps({ testID: 'step3-apple-button' }).props.onPress(); });
      expect(mockPush).not.toHaveBeenCalled();
      expect(texts(tree)).toContain("Couldn't sign in");
    });

    // The button must not be left spinning after any of the branches above.
    it('clears the busy state whatever the collision flow returns', async () => {
      mockSignInWithApple.mockResolvedValue({
        ok: false, reason: 'credential-already-in-use', signIn: jest.fn(),
      });
      mockAdoptOnCollision.mockResolvedValue({ status: 'cancelled' });
      const tree = render();
      await act(async () => { await tree.root.findByProps({ testID: 'step3-apple-button' }).props.onPress(); });
      expect(tree.root.findByProps({ testID: 'step3-apple-button' }).props.disabled).toBe(false);
    });
  });

  // I6: an already-linked user reaching this screen (via "Create New Trip" from My Trips)
  // previously still saw "Sign in with Apple" — tapping it hit
  // auth/provider-already-linked and rendered the raw Firebase message.
  describe('already-authenticated branch (I6)', () => {
    beforeEach(() => {
      mockAuthState = { status: 'authenticated', user: { uid: 'u', email: 'ada@example.com' }, signInWithApple: mockSignInWithApple };
    });

    it('shows the signed-in identity and a Continue action instead of the Apple button', () => {
      const tree = render();
      expect(texts(tree)).toContain('ada@example.com');
      expect(tree.root.findAllByProps({ testID: 'step3-apple-button' })).toHaveLength(0);
      expect(tree.root.findAllByProps({ testID: 'step3-continue' }).length).toBeGreaterThan(0);
    });

    it('Continue advances to step 4 without ever calling signInWithApple', () => {
      const tree = render();
      act(() => { tree.root.findByProps({ testID: 'step3-continue' }).props.onPress(); });
      expect(mockPush).toHaveBeenCalledWith('/onboarding/step-4');
      expect(mockSignInWithApple).not.toHaveBeenCalled();
    });

    it('falls back to displayName, then a generic label, when email is absent', () => {
      mockAuthState = { status: 'authenticated', user: { uid: 'u', displayName: 'Ada Lovelace' }, signInWithApple: mockSignInWithApple };
      const tree = render();
      expect(texts(tree)).toContain('Ada Lovelace');

      mockAuthState = { status: 'authenticated', user: { uid: 'u' }, signInWithApple: mockSignInWithApple };
      const tree2 = render();
      expect(texts(tree2)).toContain('your Apple ID');
    });
  });
});
