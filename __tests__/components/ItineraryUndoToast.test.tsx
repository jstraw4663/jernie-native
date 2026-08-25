import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import {
  ITINERARY_UNDO_MS, ItineraryUndoToast,
} from '@/src/features/jernie/itinerary/ItineraryUndoToast';

function visibleText(tree: renderer.ReactTestRenderer): string {
  return tree.root.findAllByType(Text).map(node => {
    const children = node.props.children;
    return Array.isArray(children) ? children.join('') : String(children);
  }).join(' | ');
}

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

test('offers Undo and dismisses after the designed four-second window', () => {
  const onUndo = jest.fn();
  const onDismiss = jest.fn();
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <ItineraryUndoToast title="Eventide" onUndo={onUndo} onDismiss={onDismiss} />,
    );
  });

  expect(visibleText(tree)).toContain('Removed Eventide');
  const undo = tree.root.findAll(node =>
    node.props.testID === 'itinerary-undo-action' && typeof node.props.onPress === 'function',
  )[0];
  act(() => { undo.props.onPress(); });
  expect(onUndo).toHaveBeenCalledTimes(1);

  act(() => { jest.advanceTimersByTime(ITINERARY_UNDO_MS - 1); });
  expect(onDismiss).not.toHaveBeenCalled();
  act(() => { jest.advanceTimersByTime(1); });
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

test('failed delayed deletion stays visible and changes the action to Retry', () => {
  const onDismiss = jest.fn();
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <ItineraryUndoToast
        title="Eventide"
        failed
        onUndo={jest.fn()}
        onDismiss={onDismiss}
      />,
    );
  });

  expect(visibleText(tree)).toContain("Couldn't remove Eventide");
  expect(visibleText(tree)).toContain('Retry');
  act(() => { jest.advanceTimersByTime(ITINERARY_UNDO_MS * 2); });
  expect(onDismiss).not.toHaveBeenCalled();
});

test('a failed removal can be dismissed, so a retry that keeps failing is not a permanent bar', () => {
  const onDismiss = jest.fn();
  const onUndo = jest.fn();
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <ItineraryUndoToast title="Eventide" failed onUndo={onUndo} onDismiss={onDismiss} />,
    );
  });

  const dismiss = tree.root.findAll(node =>
    node.props.testID === 'itinerary-undo-dismiss' && typeof node.props.onPress === 'function',
  )[0];
  act(() => { dismiss.props.onPress(); });

  expect(onDismiss).toHaveBeenCalledTimes(1);
  expect(onUndo).not.toHaveBeenCalled();
});

test('the resting bar offers no dismiss — its only exits are Undo and the timer', () => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <ItineraryUndoToast title="Eventide" onUndo={jest.fn()} onDismiss={jest.fn()} />,
    );
  });

  expect(tree.root.findAll(node => node.props.testID === 'itinerary-undo-dismiss')).toHaveLength(0);
});
