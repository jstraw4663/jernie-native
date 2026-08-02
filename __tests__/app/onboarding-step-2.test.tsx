const mockGeocodeCity = jest.fn();
jest.mock('@/src/lib/geocodeClient', () => ({
  geocodeCity: (...args: unknown[]) => mockGeocodeCity(...args),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSetFirstStop = jest.fn();
jest.mock('@/src/contexts/OnboardingDraftContext', () => ({
  useOnboardingDraft: () => ({
    draft: {
      name: 'NYC Summer',
      organizerHandle: 'Jeremy',
      pills: [],
      firstStop: null,
      setupIntent: { flights: true, stays: true, car: true, restaurants: true },
    },
    setName: jest.fn(),
    setOrganizerHandle: jest.fn(),
    setPills: jest.fn(),
    setFirstStop: mockSetFirstStop,
    setSetupIntent: jest.fn(),
  }),
}));

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import OnboardingStep2 from '@/app/onboarding/step-2';

function renderScreen() {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<OnboardingStep2 />); });
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('app/onboarding/step-2', () => {
  test('renders the shared StopForm', () => {
    const tree = renderScreen();
    expect(tree.root.findByProps({ testID: 'stop-form-city-input' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'stop-form-submit-button' })).toBeTruthy();
  });

  test('a successfully resolved stop is written into the draft and advances straight to step-4 (no step-3)', async () => {
    mockGeocodeCity.mockResolvedValue({ found: true, lat: 40.78, lon: -73.97, city: 'Manhattan', region: 'NY' });
    const tree = renderScreen();

    act(() => { tree.root.findByProps({ testID: 'stop-form-city-input' }).props.onChangeText('Manhattan'); });
    await act(async () => {
      await tree.root.findByProps({ testID: 'stop-form-find-button' }).props.onPress();
    });
    act(() => { tree.root.findByProps({ testID: 'stop-form-start-date' }).props.onChangeText('2026-08-10'); });
    act(() => { tree.root.findByProps({ testID: 'stop-form-end-date' }).props.onChangeText('2026-08-14'); });
    await act(async () => {
      await tree.root.findByProps({ testID: 'stop-form-submit-button' }).props.onPress();
    });

    expect(mockSetFirstStop).toHaveBeenCalledWith({
      city: 'Manhattan',
      region: 'NY',
      lat: 40.78,
      lon: -73.97,
      dates: { start: '2026-08-10', end: '2026-08-14' },
    });
    expect(mockPush).toHaveBeenCalledWith('/onboarding/step-4');
  });

  test('StopForm keeps Continue disabled without a geocode, so this screen never navigates prematurely', async () => {
    const tree = renderScreen();
    act(() => { tree.root.findByProps({ testID: 'stop-form-city-input' }).props.onChangeText('Manhattan'); });
    act(() => { tree.root.findByProps({ testID: 'stop-form-start-date' }).props.onChangeText('2026-08-10'); });
    act(() => { tree.root.findByProps({ testID: 'stop-form-end-date' }).props.onChangeText('2026-08-14'); });

    expect(tree.root.findByProps({ testID: 'stop-form-submit-button' }).props.disabled).toBe(true);
    expect(mockSetFirstStop).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
