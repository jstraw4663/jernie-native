const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockSignInWithApple = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace }) }));
jest.mock('@/src/contexts/AuthContext', () => ({
  useAuth: () => ({ status: 'anonymous', signInWithApple: mockSignInWithApple }),
}));
jest.mock('@/src/contexts/OnboardingDraftContext', () => ({
  useOnboardingDraft: () => ({
    draft: {
      name: 'Maine Summer 2026',
      colorPack: { id: 'p', stopColors: ['#2C5880'], heroGradient: ['#111111', '#222222'] },
    },
  }),
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

beforeEach(() => { jest.clearAllMocks(); });

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

  // No trip exists yet at step 3, so a collision costs nothing — sign in and carry on.
  it('signs into the existing account on collision and continues', async () => {
    const signIn = jest.fn().mockResolvedValue(undefined);
    mockSignInWithApple.mockResolvedValue({ ok: false, reason: 'credential-already-in-use', signIn });
    const tree = render();
    await act(async () => { await tree.root.findByProps({ testID: 'step3-apple-button' }).props.onPress(); });
    expect(signIn).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/onboarding/step-4');
  });
});
