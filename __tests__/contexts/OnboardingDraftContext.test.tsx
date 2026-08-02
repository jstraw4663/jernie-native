import React from 'react';
import { Text } from 'react-native';
import renderer from 'react-test-renderer';
import {
  OnboardingDraftProvider,
  useOnboardingDraft,
  type OnboardingDraftContextValue,
} from '@/src/contexts/OnboardingDraftContext';

function Capture({ onCapture }: { onCapture: (ctx: OnboardingDraftContextValue) => void }) {
  onCapture(useOnboardingDraft());
  return null;
}

// Returns a live holder (not a one-time snapshot) — `holder.current` is reassigned on every
// re-render of <Capture>, so calling a setter and then reading `holder.current.draft` after an
// `act()` reflects the post-update value, not whatever was captured at mount time.
function renderDraft(): { holder: { current: OnboardingDraftContextValue }; tree: renderer.ReactTestRenderer } {
  const holder: { current: OnboardingDraftContextValue } = { current: null as unknown as OnboardingDraftContextValue };
  let tree!: renderer.ReactTestRenderer;
  renderer.act(() => {
    tree = renderer.create(
      <OnboardingDraftProvider>
        <Capture onCapture={ctx => { holder.current = ctx; }} />
      </OnboardingDraftProvider>,
    );
  });
  return { holder, tree };
}

describe('OnboardingDraftContext', () => {
  test('starts empty, with firstStop null and all four setup-intent booleans true', () => {
    const { holder } = renderDraft();
    expect(holder.current.draft).toEqual({
      name: '',
      organizerHandle: '',
      pills: [],
      firstStop: null,
      setupIntent: { flights: true, stays: true, car: true, restaurants: true },
    });
  });

  test('useOnboardingDraft throws when called outside the provider', () => {
    function Bare() {
      useOnboardingDraft();
      return null;
    }
    // Swallow React's expected console.error for the thrown-during-render case.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    let thrown: unknown = null;
    try {
      renderer.act(() => { renderer.create(<Bare />); });
    } catch (err) {
      thrown = err;
    }
    spy.mockRestore();
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe('useOnboardingDraft must be used inside OnboardingDraftProvider');
  });

  test('each setter updates exactly its own field, leaving the rest untouched', () => {
    const { holder } = renderDraft();

    renderer.act(() => { holder.current.setName('NYC Summer'); });
    expect(holder.current.draft.name).toBe('NYC Summer');
    expect(holder.current.draft.organizerHandle).toBe('');

    renderer.act(() => { holder.current.setOrganizerHandle('Jeremy'); });
    expect(holder.current.draft.organizerHandle).toBe('Jeremy');
    expect(holder.current.draft.name).toBe('NYC Summer'); // unaffected by the previous setter

    renderer.act(() => { holder.current.setPills(['🏖️ Beach', '🍷 Wine']); });
    expect(holder.current.draft.pills).toEqual(['🏖️ Beach', '🍷 Wine']);

    const stop = { city: 'Manhattan', region: 'NY', lat: 40.78, lon: -73.97, dates: { start: '2026-08-10', end: '2026-08-14' } };
    renderer.act(() => { holder.current.setFirstStop(stop); });
    expect(holder.current.draft.firstStop).toEqual(stop);

    renderer.act(() => { holder.current.setSetupIntent({ flights: false, stays: true, car: false, restaurants: true }); });
    expect(holder.current.draft.setupIntent).toEqual({ flights: false, stays: true, car: false, restaurants: true });

    // Everything set earlier is still intact after all five setters have fired.
    expect(holder.current.draft).toEqual({
      name: 'NYC Summer',
      organizerHandle: 'Jeremy',
      pills: ['🏖️ Beach', '🍷 Wine'],
      firstStop: stop,
      setupIntent: { flights: false, stays: true, car: false, restaurants: true },
    });
  });

  test('draft state persists across a consumer swap under the same provider instance, simulating step-to-step navigation', () => {
    let captured!: OnboardingDraftContextValue;
    let tree!: renderer.ReactTestRenderer;
    renderer.act(() => {
      tree = renderer.create(
        <OnboardingDraftProvider>
          <Capture onCapture={ctx => { captured = ctx; }} />
        </OnboardingDraftProvider>,
      );
    });
    renderer.act(() => { captured.setName('Persisted Trip'); });

    // Simulate expo-router unmounting step-1's screen and mounting step-2's screen while the
    // Provider — which lives in _layout.tsx, above the Stack — stays mounted throughout.
    renderer.act(() => {
      tree.update(
        <OnboardingDraftProvider>
          <Text>step-2 placeholder</Text>
        </OnboardingDraftProvider>,
      );
    });
    renderer.act(() => {
      tree.update(
        <OnboardingDraftProvider>
          <Capture onCapture={ctx => { captured = ctx; }} />
        </OnboardingDraftProvider>,
      );
    });

    expect(captured.draft.name).toBe('Persisted Trip');
  });
});
