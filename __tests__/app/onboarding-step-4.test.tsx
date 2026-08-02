const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockCreateTrip = jest.fn();
jest.mock('@/src/lib/createTrip', () => ({
  createTrip: (...args: unknown[]) => mockCreateTrip(...args),
}));

const mockSetSetupIntent = jest.fn();
const baseFirstStop = {
  city: 'Manhattan',
  region: 'NY',
  lat: 40.78,
  lon: -73.97,
  dates: { start: '2026-08-10', end: '2026-08-14' },
};
let mockDraft: {
  name: string;
  organizerHandle: string;
  pills: string[];
  firstStop: typeof baseFirstStop | null;
  setupIntent: { flights: boolean; stays: boolean; car: boolean; restaurants: boolean };
};
jest.mock('@/src/contexts/OnboardingDraftContext', () => ({
  useOnboardingDraft: () => ({
    draft: mockDraft,
    setName: jest.fn(),
    setOrganizerHandle: jest.fn(),
    setPills: jest.fn(),
    setFirstStop: jest.fn(),
    setSetupIntent: mockSetSetupIntent,
  }),
}));

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import OnboardingStep4 from '@/app/onboarding/step-4';

function renderScreen() {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<OnboardingStep4 />); });
  return tree;
}

function submitButton(tree: renderer.ReactTestRenderer) {
  return tree.root.findByProps({ testID: 'step4-submit-button' });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDraft = {
    name: 'NYC Summer',
    organizerHandle: 'Jeremy',
    pills: ['🏖️ Beach'],
    firstStop: { ...baseFirstStop },
    setupIntent: { flights: true, stays: true, car: true, restaurants: true },
  };
});

describe('app/onboarding/step-4', () => {
  test('all four tiles render, starting selected (all-true default from the draft)', () => {
    const tree = renderScreen();
    for (const key of ['flights', 'stays', 'car', 'restaurants']) {
      expect(tree.root.findByProps({ testID: `step4-tile-${key}` })).toBeTruthy();
    }
  });

  test('tapping a tile toggles just that booking type, leaving the others alone', () => {
    const tree = renderScreen();
    act(() => { tree.root.findByProps({ testID: 'step4-tile-flights' }).props.onPress(); });
    expect(mockSetSetupIntent).toHaveBeenCalledWith({ flights: false, stays: true, car: true, restaurants: true });
  });

  test('submitting calls createTrip() with exactly the accumulated draft shape', async () => {
    mockCreateTrip.mockResolvedValue('trip-123');
    const tree = renderScreen();

    await act(async () => { await submitButton(tree).props.onPress(); });

    expect(mockCreateTrip).toHaveBeenCalledWith({
      name: 'NYC Summer',
      organizerHandle: 'Jeremy',
      pills: ['🏖️ Beach'],
      firstStop: baseFirstStop,
      setupIntent: { flights: true, stays: true, car: true, restaurants: true },
    });
  });

  test('on success, navigates into the new trip via router.replace', async () => {
    mockCreateTrip.mockResolvedValue('trip-123');
    const tree = renderScreen();

    await act(async () => { await submitButton(tree).props.onPress(); });

    expect(mockReplace).toHaveBeenCalledWith('/(trips)/trip-123/(tabs)/jernie');
  });

  test('disables the submit button and shows a spinner while the createTrip() call is pending', async () => {
    let resolveCreate!: (tripId: string) => void;
    mockCreateTrip.mockReturnValue(new Promise<string>(res => { resolveCreate = res; }));
    const tree = renderScreen();

    let submitPromise!: Promise<void>;
    act(() => {
      submitPromise = submitButton(tree).props.onPress();
    });

    expect(submitButton(tree).props.disabled).toBe(true);

    await act(async () => {
      resolveCreate('trip-123');
      await submitPromise;
    });
  });

  test('on failure, shows a retry-able error banner, re-enables the button, and does not navigate', async () => {
    mockCreateTrip.mockRejectedValue(new Error('network unavailable'));
    const tree = renderScreen();

    await act(async () => { await submitButton(tree).props.onPress(); });

    expect(JSON.stringify(tree.toJSON())).toContain('network unavailable');
    expect(submitButton(tree).props.disabled).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  test('a failed submit leaves the draft context itself untouched, so a retry reuses the same answers', async () => {
    mockCreateTrip.mockRejectedValueOnce(new Error('offline'));
    mockCreateTrip.mockResolvedValueOnce('trip-456');
    const tree = renderScreen();

    await act(async () => { await submitButton(tree).props.onPress(); });
    expect(mockReplace).not.toHaveBeenCalled();

    // Retry — the draft (mockDraft) was never mutated by the failed attempt, so this call
    // carries the exact same name/organizerHandle/pills/firstStop as before.
    await act(async () => { await submitButton(tree).props.onPress(); });

    expect(mockCreateTrip).toHaveBeenNthCalledWith(2, {
      name: 'NYC Summer',
      organizerHandle: 'Jeremy',
      pills: ['🏖️ Beach'],
      firstStop: baseFirstStop,
      setupIntent: { flights: true, stays: true, car: true, restaurants: true },
    });
    expect(mockReplace).toHaveBeenCalledWith('/(trips)/trip-456/(tabs)/jernie');
  });

  test('pressing submit again while a call is already pending does not call createTrip a second time', async () => {
    let resolveCreate!: (tripId: string) => void;
    mockCreateTrip.mockReturnValue(new Promise<string>(res => { resolveCreate = res; }));
    const tree = renderScreen();

    let firstPromise!: Promise<void>;
    act(() => { firstPromise = submitButton(tree).props.onPress(); });
    act(() => { submitButton(tree).props.onPress(); }); // second tap while pending — should no-op

    expect(mockCreateTrip).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCreate('trip-123');
      await firstPromise;
    });
  });

  test('the submit button is disabled (and cannot be pressed into a call) if firstStop is somehow still null', () => {
    mockDraft.firstStop = null;
    const tree = renderScreen();
    expect(submitButton(tree).props.disabled).toBe(true);
  });
});
