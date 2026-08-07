import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { HeroLayer } from '@/src/features/jernie/HeroLayer';
import type { Trip, StopWithColor } from '@/src/types';

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    name: 'New England',
    ownerId: 'user-1',
    dates: { start: '2026-08-10', end: '2026-08-20' },
    ...overrides,
  } as Trip;
}

function makeStop(overrides: Partial<StopWithColor> = {}): StopWithColor {
  return {
    id: 'stop-1',
    tripId: 'trip-1',
    city: 'Portland',
    region: 'ME',
    emoji: '🦞',
    lat: 43.66,
    lon: -70.26,
    dates: { start: '2026-08-10', end: '2026-08-14' },
    order: 0,
    color: '#123456',
    ...overrides,
  };
}

function renderHero(ui: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(ui); });
  return tree;
}

describe('HeroLayer — edit affordance', () => {
  test('does not render the edit control when onEditStop is omitted', () => {
    const tree = renderHero(
      <HeroLayer trip={makeTrip()} activeStop={makeStop()} />,
    );
    expect(tree.root.findAllByProps({ testID: 'hero-edit-button' })).toHaveLength(0);
  });

  test('renders the edit control when onEditStop is provided', () => {
    const tree = renderHero(
      <HeroLayer trip={makeTrip()} activeStop={makeStop()} onEditStop={() => {}} />,
    );
    expect(tree.root.findAllByProps({ testID: 'hero-edit-button' }).length).toBeGreaterThan(0);
  });

  test('pressing the edit control calls onEditStop exactly once', () => {
    const onEditStop = jest.fn();
    const tree = renderHero(
      <HeroLayer trip={makeTrip()} activeStop={makeStop()} onEditStop={onEditStop} />,
    );
    act(() => {
      tree.root.findByProps({ testID: 'hero-edit-button' }).props.onPress();
    });
    expect(onEditStop).toHaveBeenCalledTimes(1);
  });

  test('still renders the trip name alongside the affordance', () => {
    const tree = renderHero(
      <HeroLayer trip={makeTrip()} activeStop={makeStop()} onEditStop={() => {}} />,
    );
    expect(JSON.stringify(tree.toJSON())).toContain('New England');
  });
});

describe('HeroLayer — the title block follows the stop being viewed', () => {
  const BROOKLYN = makeStop({
    id: 'stop-2', city: 'Brooklyn', region: 'NY', color: '#654321',
    dates: { start: '2026-08-15', end: '2026-08-18' },
  });

  test('shows visibleStop\'s city, not activeStop\'s, while paging', () => {
    const tree = renderHero(
      <HeroLayer trip={makeTrip()} activeStop={makeStop()} visibleStop={BROOKLYN} />,
    );
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Brooklyn');
    expect(json).not.toContain('Portland');
  });

  test('shows visibleStop\'s dates and region in the subtitle', () => {
    const tree = renderHero(
      <HeroLayer trip={makeTrip()} activeStop={makeStop()} visibleStop={BROOKLYN} />,
    );
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Aug 15');
    expect(json).toContain('NY');
    expect(json).not.toContain('ME');
  });

  test('updates the title when visibleStop changes, as a swipe does', () => {
    const tree = renderHero(
      <HeroLayer trip={makeTrip()} activeStop={makeStop()} visibleStop={makeStop()} />,
    );
    expect(JSON.stringify(tree.toJSON())).toContain('Portland');

    act(() => {
      tree.update(
        <HeroLayer trip={makeTrip()} activeStop={makeStop()} visibleStop={BROOKLYN} />,
      );
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Brooklyn');
    expect(json).not.toContain('Portland');
  });

  test('falls back to activeStop when visibleStop is omitted', () => {
    const tree = renderHero(<HeroLayer trip={makeTrip()} activeStop={makeStop()} />);
    expect(JSON.stringify(tree.toJSON())).toContain('Portland');
  });
});
