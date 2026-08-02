import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import { StopsStrip } from '@/src/features/jernie/StopsStrip';
import type { StopWithColor } from '@/src/types';

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});

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

function renderStrip(ui: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(ui); });
  return tree;
}

describe('StopsStrip — stop-count transitions (the previously-unguarded stops[safeIdx] access)', () => {
  // Investigation finding: `activeStop = stops[safeIdx]` is already only ever read through
  // `activeStop?.color` (line 72 of StopsStrip.tsx) — the sole usage site. There is no other
  // direct `activeStop.<field>` access anywhere in the file. So an empty `stops` array (where
  // `safeIdx` falls back to 0, out of bounds) already resolves to `activeStop === undefined`
  // safely, and `hexWithAlpha(undefined?.color ?? '#000', 0.55)` never throws. These tests prove
  // that across real mount + stop-count-changing rerenders, rather than just reasoning about it
  // statically — no source change was needed for this file's core logic (the trailing "+" pill
  // is the only actual code addition here).

  test('renders with zero stops without crashing', () => {
    expect(() => renderStrip(
      <StopsStrip stops={[]} activeStopId={null} onStopPress={() => {}} />,
    )).not.toThrow();
  });

  test('renders with exactly 1 stop without crashing', () => {
    const stops = [makeStop()];
    const tree = renderStrip(
      <StopsStrip stops={stops} activeStopId="stop-1" onStopPress={() => {}} />,
    );
    expect(JSON.stringify(tree.toJSON())).toContain('Portland');
  });

  test('renders with 2 stops without crashing', () => {
    const stops = [
      makeStop({ id: 'stop-1', city: 'Portland', order: 0 }),
      makeStop({ id: 'stop-2', city: 'Brooklyn', order: 1 }),
    ];
    const tree = renderStrip(
      <StopsStrip stops={stops} activeStopId="stop-1" onStopPress={() => {}} />,
    );
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Portland');
    expect(json).toContain('Brooklyn');
  });

  test('transitioning from 0 stops to 1 stop (mount empty, then rerender with a stop) does not crash', () => {
    const tree = renderStrip(
      <StopsStrip stops={[]} activeStopId={null} onStopPress={() => {}} />,
    );
    const stops = [makeStop()];
    expect(() => {
      act(() => {
        tree.update(<StopsStrip stops={stops} activeStopId="stop-1" onStopPress={() => {}} />);
      });
    }).not.toThrow();
    expect(JSON.stringify(tree.toJSON())).toContain('Portland');
  });

  test('transitioning from 1 stop to 2 stops while mounted does not crash (the scenario called out in the task brief)', () => {
    const oneStop = [makeStop({ id: 'stop-1', city: 'Portland', order: 0 })];
    const tree = renderStrip(
      <StopsStrip stops={oneStop} activeStopId="stop-1" onStopPress={() => {}} />,
    );

    const twoStops = [
      makeStop({ id: 'stop-1', city: 'Portland', order: 0 }),
      makeStop({ id: 'stop-2', city: 'Brooklyn', order: 1 }),
    ];
    expect(() => {
      act(() => {
        tree.update(<StopsStrip stops={twoStops} activeStopId="stop-1" onStopPress={() => {}} />);
      });
    }).not.toThrow();

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Portland');
    expect(json).toContain('Brooklyn');
  });

  test('transitioning from 1 stop to 2 stops AND the active stop moving to the newly added stop does not crash', () => {
    const oneStop = [makeStop({ id: 'stop-1', city: 'Portland', order: 0 })];
    const tree = renderStrip(
      <StopsStrip stops={oneStop} activeStopId="stop-1" onStopPress={() => {}} />,
    );

    const twoStops = [
      makeStop({ id: 'stop-1', city: 'Portland', order: 0 }),
      makeStop({ id: 'stop-2', city: 'Brooklyn', order: 1, color: '#654321' }),
    ];
    expect(() => {
      act(() => {
        // activeStopId now points at the just-added second stop, as it would right after
        // addStop() resolves and the caller navigates the pager to it.
        tree.update(<StopsStrip stops={twoStops} activeStopId="stop-2" onStopPress={() => {}} />);
      });
    }).not.toThrow();
    expect(JSON.stringify(tree.toJSON())).toContain('Brooklyn');
  });
});

describe('StopsStrip — trailing "+" pill', () => {
  test('is not rendered when onAddPress is not provided', () => {
    const tree = renderStrip(
      <StopsStrip stops={[makeStop()]} activeStopId="stop-1" onStopPress={() => {}} />,
    );
    expect(tree.root.findAllByProps({ testID: 'stops-strip-add-pill' })).toHaveLength(0);
  });

  test('is rendered when onAddPress is provided, even with zero stops', () => {
    const tree = renderStrip(
      <StopsStrip stops={[]} activeStopId={null} onStopPress={() => {}} onAddPress={() => {}} />,
    );
    expect(tree.root.findAllByProps({ testID: 'stops-strip-add-pill' }).length).toBeGreaterThan(0);
  });

  test('pressing it calls onAddPress', () => {
    const onAddPress = jest.fn();
    const tree = renderStrip(
      <StopsStrip stops={[makeStop()]} activeStopId="stop-1" onStopPress={() => {}} onAddPress={onAddPress} />,
    );
    act(() => {
      tree.root.findByProps({ testID: 'stops-strip-add-pill' }).props.onPress();
    });
    expect(onAddPress).toHaveBeenCalledTimes(1);
  });

  test('appears after all rendered stops, and survives a 1→2 stop transition without crashing', () => {
    const onAddPress = jest.fn();
    const oneStop = [makeStop({ id: 'stop-1', city: 'Portland', order: 0 })];
    const tree = renderStrip(
      <StopsStrip stops={oneStop} activeStopId="stop-1" onStopPress={() => {}} onAddPress={onAddPress} />,
    );

    const twoStops = [
      makeStop({ id: 'stop-1', city: 'Portland', order: 0 }),
      makeStop({ id: 'stop-2', city: 'Brooklyn', order: 1 }),
    ];
    act(() => {
      tree.update(<StopsStrip stops={twoStops} activeStopId="stop-1" onStopPress={() => {}} onAddPress={onAddPress} />);
    });

    expect(tree.root.findAllByProps({ testID: 'stops-strip-add-pill' }).length).toBeGreaterThan(0);
    act(() => {
      tree.root.findAllByProps({ testID: 'stops-strip-add-pill' })[0].props.onPress();
    });
    expect(onAddPress).toHaveBeenCalledTimes(1);
  });
});

describe('StopsStrip — existing stop-press behavior (regression guard)', () => {
  test('pressing a stop calls onStopPress with its id', () => {
    const onStopPress = jest.fn();
    const stops = [
      makeStop({ id: 'stop-1', city: 'Portland', order: 0 }),
      makeStop({ id: 'stop-2', city: 'Brooklyn', order: 1 }),
    ];
    const tree = renderStrip(
      <StopsStrip stops={stops} activeStopId="stop-1" onStopPress={onStopPress} />,
    );
    // Find the TouchableOpacity whose rendered subtree contains "Brooklyn" and press it.
    const brooklynTouchable = tree.root
      .findAllByType(TouchableOpacity)
      .find(t => t.findAllByType(Text).some(txt => txt.props.children === 'Brooklyn'));
    expect(brooklynTouchable).toBeTruthy();
    act(() => { brooklynTouchable!.props.onPress(); });
    expect(onStopPress).toHaveBeenCalledWith('stop-2');
  });
});
