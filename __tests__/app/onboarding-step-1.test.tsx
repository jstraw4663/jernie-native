const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
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

beforeEach(() => {
  jest.clearAllMocks();
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
    expect(mockSetPills).toHaveBeenCalledWith(['🦞 Seafood', '🏖️ Beach']);
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
});
