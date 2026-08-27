const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

// Step 1 is the only screen a returning user with no trips can reach, so it carries the
// sign-in entry point. Everything below mirrors Profile's four-branch LinkOutcome handling.
let mockAuthState: any;
const mockSignInWithApple = jest.fn();
jest.mock('@/src/contexts/AuthContext', () => ({ useAuth: () => mockAuthState }));
// The trust gate, the three-way prompt and the trip copy live in useCollisionSignIn
// (__tests__/useCollisionSignIn.test.tsx). This screen owns delegating to it and mapping
// each outcome onto navigation or an error.
const mockAdoptOnCollision = jest.fn();
jest.mock('@/src/hooks/useCollisionSignIn', () => ({
  useCollisionSignIn: () => mockAdoptOnCollision,
}));

const mockSetName = jest.fn();
const mockSetOrganizerHandle = jest.fn();
const mockSetPills = jest.fn();
let mockDraft = {
  name: '',
  organizerHandle: '',
  pills: [] as string[],
  firstStop: null,
  setupIntent: { flights: true, stays: true, car: true, restaurants: true },
};
jest.mock('@/src/contexts/OnboardingDraftContext', () => ({
  useOnboardingDraft: () => ({
    draft: mockDraft,
    setName: mockSetName,
    setOrganizerHandle: mockSetOrganizerHandle,
    setPills: mockSetPills,
    setFirstStop: jest.fn(),
    setSetupIntent: jest.fn(),
  }),
}));

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import OnboardingStep1 from '@/app/onboarding/step-1';

function renderScreen() {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<OnboardingStep1 />); });
  return tree;
}

function nameInput(tree: renderer.ReactTestRenderer) {
  return tree.root.findByProps({ testID: 'step1-trip-name' });
}
function handleInput(tree: renderer.ReactTestRenderer) {
  return tree.root.findByProps({ testID: 'step1-organizer-handle' });
}
function continueButton(tree: renderer.ReactTestRenderer) {
  return tree.root.findByProps({ testID: 'step1-continue-button' });
}

function signInLink(tree: renderer.ReactTestRenderer) {
  return tree.root.findByProps({ testID: 'step1-signin' });
}
function texts(tree: renderer.ReactTestRenderer): string {
  const { Text } = require('react-native');
  return tree.root.findAllByType(Text).map((t: any) => {
    const c = t.props.children;
    return Array.isArray(c) ? c.join('') : String(c);
  }).join(' | ');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthState = { status: 'anonymous', signInWithApple: mockSignInWithApple };
  mockAdoptOnCollision.mockReset().mockResolvedValue({ status: 'signed-in', failed: 0 });
  mockDraft = {
    name: '',
    organizerHandle: '',
    pills: [],
    firstStop: null,
    setupIntent: { flights: true, stays: true, car: true, restaurants: true },
  };
});

describe('app/onboarding/step-1', () => {
  test('Continue is disabled before anything is typed', () => {
    const tree = renderScreen();
    expect(continueButton(tree).props.disabled).toBe(true);
  });

  test('Continue stays disabled with only the trip name filled in', () => {
    const tree = renderScreen();
    act(() => { nameInput(tree).props.onChangeText('NYC Summer'); });
    expect(continueButton(tree).props.disabled).toBe(true);
  });

  test('Continue stays disabled with only the organizer name filled in', () => {
    const tree = renderScreen();
    act(() => { handleInput(tree).props.onChangeText('Jeremy'); });
    expect(continueButton(tree).props.disabled).toBe(true);
  });

  test('Continue enables once both name fields are non-empty', () => {
    const tree = renderScreen();
    act(() => { nameInput(tree).props.onChangeText('NYC Summer'); });
    act(() => { handleInput(tree).props.onChangeText('Jeremy'); });
    expect(continueButton(tree).props.disabled).toBe(false);
  });

  test('whitespace-only text does not count as filled in', () => {
    const tree = renderScreen();
    act(() => { nameInput(tree).props.onChangeText('   '); });
    act(() => { handleInput(tree).props.onChangeText('   '); });
    expect(continueButton(tree).props.disabled).toBe(true);
  });

  test('pressing Continue writes the trimmed name/handle and selected pills into the draft, then navigates to step-2', () => {
    const tree = renderScreen();
    act(() => { nameInput(tree).props.onChangeText('  NYC Summer  '); });
    act(() => { handleInput(tree).props.onChangeText('  Jeremy  '); });
    act(() => { tree.root.findByProps({ testID: 'step1-pill-0' }).props.onPress(); }); // 🦞 Seafood
    act(() => { tree.root.findByProps({ testID: 'step1-pill-2' }).props.onPress(); }); // 🏖️ Beach
    act(() => { continueButton(tree).props.onPress(); });

    expect(mockSetName).toHaveBeenCalledWith('NYC Summer');
    expect(mockSetOrganizerHandle).toHaveBeenCalledWith('Jeremy');
    expect(mockSetPills).toHaveBeenCalledWith(['Seafood', 'Beach']);
    expect(mockPush).toHaveBeenCalledWith('/onboarding/step-2');
  });

  test('vibe chips are optional — Continue works and pills stays empty when none are tapped', () => {
    const tree = renderScreen();
    act(() => { nameInput(tree).props.onChangeText('NYC Summer'); });
    act(() => { handleInput(tree).props.onChangeText('Jeremy'); });
    act(() => { continueButton(tree).props.onPress(); });

    expect(mockSetPills).toHaveBeenCalledWith([]);
    expect(mockPush).toHaveBeenCalledWith('/onboarding/step-2');
  });

  test('tapping a pill twice toggles it back off', () => {
    const tree = renderScreen();
    act(() => { nameInput(tree).props.onChangeText('NYC Summer'); });
    act(() => { handleInput(tree).props.onChangeText('Jeremy'); });
    act(() => { tree.root.findByProps({ testID: 'step1-pill-0' }).props.onPress(); });
    act(() => { tree.root.findByProps({ testID: 'step1-pill-0' }).props.onPress(); });
    act(() => { continueButton(tree).props.onPress(); });

    expect(mockSetPills).toHaveBeenCalledWith([]);
  });

  test('pressing Continue while disabled does not write into the draft or navigate', () => {
    const tree = renderScreen();
    act(() => { continueButton(tree).props.onPress(); });

    expect(mockSetName).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  // Before this, sign-in appeared only on step 3 — after a trip already existed — so a
  // returning user reinstalling the app had no route into their own account at all: the
  // zero-trip redirect lands here, and creating a throwaway trip just to reach step 3 put
  // them straight into the collision warning.
  describe('sign-in entry point', () => {
    test('offers sign-in to an anonymous user', () => {
      const tree = renderScreen();
      expect(texts(tree)).toContain('Already have an account');
    });

    test('hides the sign-in link once the user is authenticated', () => {
      mockAuthState = { status: 'authenticated', signInWithApple: mockSignInWithApple };
      const tree = renderScreen();
      expect(tree.root.findAllByProps({ testID: 'step1-signin' })).toHaveLength(0);
    });

    test('a successful sign-in replaces to / so the restored trips re-derive the destination', async () => {
      mockSignInWithApple.mockResolvedValue({ ok: true, user: { uid: 'linked-uid' } });
      const tree = renderScreen();
      await act(async () => { await signInLink(tree).props.onPress(); });
      expect(mockReplace).toHaveBeenCalledWith('/');
      expect(mockPush).not.toHaveBeenCalled();
    });

    // The whole point of this entry point: a fresh install owns nothing, so the prompt is
    // skipped entirely and the collision is invisible — it reads as an ordinary sign-in.
    test('hands a collision to the collision flow and navigates once it signs in', async () => {
      const mockSignIn = jest.fn().mockResolvedValue(undefined);
      mockSignInWithApple.mockResolvedValue({
        ok: false, reason: 'credential-already-in-use', signIn: mockSignIn,
      });
      const tree = renderScreen();
      await act(async () => { await signInLink(tree).props.onPress(); });

      expect(mockAdoptOnCollision).toHaveBeenCalledWith(mockSignIn);
      expect(mockReplace).toHaveBeenCalledWith('/');
    });

    test('stays put when the user backs out of the collision prompt', async () => {
      mockSignInWithApple.mockResolvedValue({
        ok: false, reason: 'credential-already-in-use', signIn: jest.fn(),
      });
      mockAdoptOnCollision.mockResolvedValue({ status: 'cancelled' });
      const tree = renderScreen();
      await act(async () => { await signInLink(tree).props.onPress(); });

      expect(mockReplace).not.toHaveBeenCalled();
      expect(texts(tree)).not.toContain("Couldn't sign in");
    });

    test('refuses to proceed while the trip count is still loading', async () => {
      mockSignInWithApple.mockResolvedValue({
        ok: false, reason: 'credential-already-in-use', signIn: jest.fn(),
      });
      mockAdoptOnCollision.mockResolvedValue({ status: 'untrusted' });
      const tree = renderScreen();
      await act(async () => { await signInLink(tree).props.onPress(); });

      expect(mockReplace).not.toHaveBeenCalled();
      expect(texts(tree)).toContain("Can't verify your trips yet");
    });

    test('a failed collision sign-in surfaces an error instead of navigating', async () => {
      mockSignInWithApple.mockResolvedValue({
        ok: false, reason: 'credential-already-in-use', signIn: jest.fn(),
      });
      mockAdoptOnCollision.mockResolvedValue({ status: 'failed' });
      const tree = renderScreen();
      await act(async () => { await signInLink(tree).props.onPress(); });

      expect(mockReplace).not.toHaveBeenCalled();
      expect(texts(tree)).toContain("Couldn't sign in");
    });

    test('shows the failure message when sign-in errors', async () => {
      mockSignInWithApple.mockResolvedValue({ ok: false, reason: 'error', message: 'Apple is down' });
      const tree = renderScreen();
      await act(async () => { await signInLink(tree).props.onPress(); });
      expect(texts(tree)).toContain('Apple is down');
      expect(mockReplace).not.toHaveBeenCalled();
    });

    test('cancelling shows no error and does not navigate', async () => {
      mockSignInWithApple.mockResolvedValue({ ok: false, reason: 'cancelled' });
      const tree = renderScreen();
      await act(async () => { await signInLink(tree).props.onPress(); });
      expect(mockReplace).not.toHaveBeenCalled();
      expect(texts(tree)).not.toContain("Couldn't sign in");
    });

    // Typing a trip name and then signing in would otherwise leave the draft half-filled
    // behind a navigation away from the wizard.
    test('signing in does not write anything into the onboarding draft', async () => {
      mockSignInWithApple.mockResolvedValue({ ok: true, user: { uid: 'linked-uid' } });
      const tree = renderScreen();
      act(() => { nameInput(tree).props.onChangeText('NYC Summer'); });
      await act(async () => { await signInLink(tree).props.onPress(); });
      expect(mockSetName).not.toHaveBeenCalled();
    });
  });
});
