const mockSwipeClose = jest.fn();

jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const ReactLib = require('react');
  const RN = require('react-native');
  return function MockSwipeable(props: Record<string, any>) {
    const actions = props.renderRightActions?.(
      { value: 1 },
      { value: -100 },
      { close: mockSwipeClose, openLeft: jest.fn(), openRight: jest.fn(), reset: jest.fn() },
    );
    const remove = props.renderLeftActions?.(
      { value: 1 },
      { value: 100 },
      { close: mockSwipeClose, openLeft: jest.fn(), openRight: jest.fn(), reset: jest.fn() },
    );
    return ReactLib.createElement(RN.View, { testID: props.testID }, remove, props.children, actions);
  };
});

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import {
  TIMELINE_DRAG_ACTIVATION_MS,
  TimelineEntryRow,
} from '@/src/features/jernie/itinerary/TimelineDay';
import type { TimelineEntry } from '@/src/domain/itineraryTimeline';

const BASE: TimelineEntry = {
  id: 'item:one',
  dateIso: '2026-08-10',
  stopId: 'stop-a',
  title: 'Eventide',
  category: 'food',
  time: { label: '7:00 PM', precision: 'hard', band: 'evening', sortMinutes: 19 * 60 },
  source: { kind: 'place', placeId: 'place-1', itemId: 'one' },
  order: 0,
  secured: false,
  confirmed: false,
  requiresMoveConfirmation: false,
  past: false,
  next: false,
};

// Gesture Handler's `createHandler` pushes its config down inside a `setImmediate`. Left
// mounted, that immediate fires after Jest tears the environment down, reads `Platform` off a
// dead module registry and hard-crashes the worker — a green run that still exits non-zero.
// Unmounting after each test cancels it.
const mounted: renderer.ReactTestRenderer[] = [];

function renderRow(
  entry: TimelineEntry,
  onDetails = jest.fn(),
  onNavigate = jest.fn(),
  onRemove = jest.fn(),
) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <TimelineEntryRow entry={entry} onPress={onDetails} onNavigate={onNavigate} onRemove={onRemove} />,
    );
  });
  mounted.push(tree);
  return { tree, onDetails, onNavigate, onRemove };
}

afterEach(() => {
  act(() => { mounted.splice(0).forEach(tree => tree.unmount()); });
});

beforeEach(() => { mockSwipeClose.mockClear(); });

test('drag requires an intentional half-second hold', () => {
  expect(TIMELINE_DRAG_ACTIVATION_MS).toBe(500);
});

test('every interactive row exposes Details', () => {
  const { tree, onDetails } = renderRow(BASE);
  expect(tree.root.findAllByProps({ testID: 'timeline-entry-details-item:one' }).length).toBeGreaterThan(0);
  expect(tree.root.findAllByProps({ testID: 'timeline-entry-navigate-item:one' })).toHaveLength(0);

  const details = tree.root.findAll(node =>
    node.props.testID === 'timeline-entry-details-item:one'
    && typeof node.props.onPress === 'function',
  )[0];
  act(() => { details.props.onPress(); });
  expect(mockSwipeClose).toHaveBeenCalledTimes(1);
  expect(onDetails).toHaveBeenCalledWith(BASE);
});

test('Navigate exists only when the derived row has an address', () => {
  const addressed = { ...BASE, address: '119 Exchange St' };
  const { tree, onNavigate } = renderRow(addressed);
  const navigate = tree.root.findAll(node =>
    node.props.testID === 'timeline-entry-navigate-item:one'
    && typeof node.props.onPress === 'function',
  )[0];

  act(() => { navigate.props.onPress(); });
  expect(mockSwipeClose).toHaveBeenCalledTimes(1);
  expect(onNavigate).toHaveBeenCalledWith(addressed);
});

test('every removable row exposes Remove on the opposite swipe', () => {
  const { tree, onRemove } = renderRow(BASE);
  const remove = tree.root.findAll(node =>
    node.props.testID === 'timeline-entry-remove-item:one'
    && typeof node.props.onPress === 'function',
  )[0];

  act(() => { remove.props.onPress(); });
  expect(mockSwipeClose).toHaveBeenCalledTimes(1);
  expect(onRemove).toHaveBeenCalledWith(BASE);
});

test('a lifted row shows the live destination bucket in its time column', () => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <TimelineEntryRow
        entry={BASE}
        dragActive
        previewTimeLabel="Afternoon"
      />,
    );
  });
  mounted.push(tree);

  expect(tree.root.findByProps({ testID: 'timeline-entry-time-item:one' }).props.children)
    .toBe('Afternoon');
  expect(tree.root.findByProps({ testID: 'timeline-entry-item:one' }).props.accessibilityLabel)
    .toContain('Afternoon');
});
