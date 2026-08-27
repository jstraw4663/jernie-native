jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const ReactLib = require('react');
  return function MockSwipeable({ children }: { children?: React.ReactNode }) {
    return ReactLib.createElement(ReactLib.Fragment, null, children);
  };
});
jest.mock('react-native-gesture-handler', () => {
  const actual = jest.requireActual('react-native-gesture-handler');
  const ReactLib = require('react');
  return {
    ...actual,
    GestureDetector: ({ children }: { children?: React.ReactNode }) =>
      ReactLib.createElement(ReactLib.Fragment, null, children),
  };
});

import React from 'react';
import { Text } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import renderer from 'react-test-renderer';
import {
  ItineraryDateRail, TimelineDayView, TimelineDragOverlay,
} from '@/src/features/jernie/itinerary';
import type {
  TimelineBand, TimelineDay, TimelineEntry,
} from '@/src/domain/itineraryTimeline';

// Gesture Handler's `createHandler` pushes its config down inside a `setImmediate`. Left
// mounted, that immediate fires after Jest tears the environment down, reads `Platform` off a
// dead module registry and hard-crashes the worker — a green run that still exits non-zero.
// Unmounting after each test cancels it.
const mounted: renderer.ReactTestRenderer[] = [];

function render(ui: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  renderer.act(() => { tree = renderer.create(ui); });
  mounted.push(tree);
  return tree;
}

afterEach(() => {
  renderer.act(() => { mounted.splice(0).forEach(tree => tree.unmount()); });
});

function entry(over: Partial<TimelineEntry> = {}): TimelineEntry {
  return {
    id: 'coffee',
    dateIso: '2026-05-24',
    stopId: 'stop-a',
    title: 'Speckled Ax',
    meta: 'Coffee',
    category: 'food',
    time: {
      raw: '9:30 AM', clock: '9:30 AM', label: '9:30 AM', precision: 'hard',
      band: 'morning', sortMinutes: 570,
    },
    source: { kind: 'custom', itemId: 'coffee' },
    order: 0,
    secured: false,
    confirmed: false,
    requiresMoveConfirmation: false,
    past: false,
    next: true,
    ...over,
  };
}

function bands(row = entry()): TimelineBand[] {
  return [
    { key: 'early', label: 'Early', span: '5–9 AM', entries: [], showEmptyPrompt: true },
    { key: 'morning', label: 'Morning', span: '9 – 12', entries: [row], showEmptyPrompt: true },
    { key: 'afternoon', label: 'Afternoon', span: '12 – 5', entries: [], showEmptyPrompt: true },
    { key: 'evening', label: 'Evening', span: '5 – 9 PM', entries: [], showEmptyPrompt: true },
    { key: 'late', label: 'Late', span: '9 PM +', entries: [], showEmptyPrompt: true },
  ];
}

function timelineDay(over: Partial<TimelineDay> = {}): TimelineDay {
  return {
    dateIso: '2026-05-24',
    weekday: 'Sun',
    dayOfMonth: 24,
    segments: [{ stopId: 'stop-a', city: 'Portland', order: 0, entryCount: 1 }],
    bands: bands(),
    unscheduled: [],
    count: 1,
    isToday: true,
    isPast: false,
    warning: false,
    ...over,
  };
}

describe('ItineraryDateRail', () => {
  test('renders trip dates and exposes the selected date as a tab', () => {
    const days = [
      timelineDay(),
      timelineDay({
        dateIso: '2026-05-25', weekday: 'Mon', dayOfMonth: 25,
        segments: [{ stopId: 'stop-b', city: 'Bar Harbor', order: 1, entryCount: 0 }],
        count: 0, isToday: false,
      }),
    ];
    const tree = render(
      <ItineraryDateRail
        days={days}
        selectedDateIso="2026-05-25"
        stopColors={{ 'stop-a': '#123456', 'stop-b': '#654321' }}
        onSelect={() => {}}
      />,
    );

    expect(tree.root.findByProps({ testID: 'itinerary-date-2026-05-24' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'itinerary-date-2026-05-25' }).props.accessibilityState)
      .toEqual({ selected: true });
  });

  test('reports a pressed date', () => {
    const onSelect = jest.fn();
    const tree = render(
      <ItineraryDateRail
        days={[timelineDay()]}
        selectedDateIso="2026-05-24"
        stopColors={{ 'stop-a': '#123456' }}
        onSelect={onSelect}
      />,
    );

    renderer.act(() => {
      tree.root.findByProps({ testID: 'itinerary-date-2026-05-24' }).props.onPress();
    });
    expect(onSelect).toHaveBeenCalledWith('2026-05-24');
  });
});

describe('TimelineDayView', () => {
  test('always renders the five exact time bands and its real rows', () => {
    const tree = render(
      <TimelineDayView day={timelineDay()} stopColors={{ 'stop-a': '#123456' }} />,
    );

    for (const key of ['early', 'morning', 'afternoon', 'evening', 'late']) {
      expect(tree.root.findByProps({ testID: `timeline-band-2026-05-24-${key}` })).toBeTruthy();
    }
    expect(tree.root.findByProps({ testID: 'timeline-entry-coffee' })).toBeTruthy();
    expect(tree.root.findAllByType(Text).map(node => node.props.children)).toContain('Speckled Ax');
  });

  test('renders stay and one stop transition on a handoff day', () => {
    const tree = render(
      <TimelineDayView
        day={timelineDay({
          segments: [
            { stopId: 'stop-a', city: 'Portland', order: 0, entryCount: 1 },
            { stopId: 'stop-b', city: 'Bar Harbor', order: 1, entryCount: 0 },
          ],
          transition: {
            fromStopId: 'stop-a', fromCity: 'Portland',
            toStopId: 'stop-b', toCity: 'Bar Harbor',
          },
          stay: {
            bookingId: 'hotel-b', stopId: 'stop-b', name: 'Bar Harbor Inn',
            detail: 'not yet confirmed', confirmed: false,
          },
          warning: true,
        })}
        stopColors={{ 'stop-a': '#123456', 'stop-b': '#654321' }}
      />,
    );

    expect(tree.root.findByProps({ testID: 'timeline-stay-2026-05-24' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'timeline-transition-2026-05-24' })).toBeTruthy();
  });

  test('reports row presses and empty-band additions', () => {
    const onEntryPress = jest.fn();
    const onAdd = jest.fn();
    const tree = render(
      <TimelineDayView
        day={timelineDay()}
        stopColors={{ 'stop-a': '#123456' }}
        onEntryPress={onEntryPress}
        onAdd={onAdd}
      />,
    );

    renderer.act(() => {
      tree.root.findByProps({ testID: 'timeline-entry-coffee' }).props.onPress();
      tree.root.findByProps({ testID: 'timeline-add-2026-05-24-afternoon' }).props.onPress();
    });

    expect(onEntryPress).toHaveBeenCalledWith(expect.objectContaining({ id: 'coffee' }));
    expect(onAdd).toHaveBeenCalledWith('2026-05-24', 'afternoon');
  });

  test('keeps unrecognized time labels in an explicit unscheduled section', () => {
    const unscheduled = entry({
      id: 'weather-plan',
      title: 'Beach if clear',
      time: {
        raw: 'after the rain', label: 'after the rain', precision: 'unscheduled',
        sortMinutes: Number.MAX_SAFE_INTEGER,
      },
    });
    const tree = render(
      <TimelineDayView
        day={timelineDay({ bands: bands().map(band => ({ ...band, entries: [] })), unscheduled: [unscheduled] })}
        stopColors={{ 'stop-a': '#123456' }}
      />,
    );

    expect(tree.root.findByProps({ testID: 'timeline-unscheduled-2026-05-24' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'timeline-entry-weather-plan' })).toBeTruthy();
  });

  test('does not reflow an empty day when another day starts dragging', () => {
    const tree = render(
      <TimelineDayView
        day={timelineDay({
          dateIso: '2026-05-25', weekday: 'Mon', dayOfMonth: 25,
          bands: bands().map(band => ({ ...band, entries: [] })),
          count: 0,
        })}
        stopColors={{ 'stop-a': '#123456' }}
        dragPreview={{
          entryId: 'coffee',
          sourceDateIso: '2026-05-24',
          destinationDateIso: '2026-05-25',
          destinationBandKey: 'unscheduled',
        }}
      />,
    );

    expect(tree.root.findAllByProps({ testID: 'timeline-unscheduled-2026-05-25' })).toHaveLength(0);
    expect(tree.root.findByProps({ testID: 'timeline-band-2026-05-25-afternoon' }).props.style)
      .toEqual([false]);
  });

  test('enables layout motion only for the post-drop settle window', () => {
    const sharedProps = {
      day: timelineDay(),
      stopColors: { 'stop-a': '#123456' },
      dragPlacements: {
        coffee: { stopId: 'stop-a', dayId: 'day-a', itemId: 'coffee' },
      },
      onEntryDrop: () => {},
    };
    const idle = render(<TimelineDayView {...sharedProps} />);
    const settling = render(<TimelineDayView {...sharedProps} settleLayout />);

    expect(idle.root.findAll(node => Boolean(node.props.layout))).toHaveLength(0);
    expect(settling.root.findAll(node => Boolean(node.props.layout)).length).toBeGreaterThanOrEqual(7);
    expect(settling.root.findByProps({ testID: 'timeline-day-2026-05-24' }).props.layout).toBeTruthy();
    expect(settling.root.findByProps({ testID: 'timeline-band-2026-05-24-morning' }).props.layout).toBeTruthy();
  });

  test('adds drag affordances only for rows backed by stored itinerary items', () => {
    const synthetic = entry({
      id: 'booking:restaurant-1:reservation',
      source: { kind: 'booking', bookingId: 'restaurant-1', event: 'reservation' },
      secured: true,
      requiresMoveConfirmation: true,
    });
    const tree = render(
      <TimelineDayView
        day={timelineDay({
          bands: bands().map(band => band.key === 'morning'
            ? { ...band, entries: [entry(), synthetic] }
            : band),
          count: 2,
        })}
        stopColors={{ 'stop-a': '#123456' }}
        dragPlacements={{
          coffee: { stopId: 'stop-a', dayId: 'day-a', itemId: 'coffee' },
        }}
        onEntryDrop={() => {}}
      />,
    );

    expect(tree.root.findByProps({ testID: 'timeline-entry-drag-handle-coffee' })).toBeTruthy();
    expect(tree.root.findAllByProps({
      testID: 'timeline-entry-drag-handle-booking:restaurant-1:reservation',
    })).toHaveLength(0);
  });
});

describe('TimelineDragOverlay', () => {
  test('renders the lifted row and destination marker above the timeline', () => {
    const shared = (value: number) => ({ value }) as SharedValue<number>;
    const tree = render(
      <TimelineDragOverlay
        overlay={{
          entry: entry(),
          height: 52,
          previewTimeLabel: 'Afternoon',
          placementLabel: 'Before Jordan Pond House · Mon May 25',
        }}
        rowTop={shared(180)}
        indicatorTop={shared(260)}
        screenOriginY={shared(20)}
      />,
    );

    expect(tree.root.findByProps({ testID: 'timeline-drag-overlay' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'timeline-overlay-row-coffee' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'timeline-overlay-placeholder-coffee' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'timeline-overlay-indicator-coffee' })).toBeTruthy();
    const copy = tree.root.findAllByType(Text).flatMap(node => node.props.children);
    expect(copy).toContain('Afternoon');
    expect(copy).toContain('Before Jordan Pond House · Mon May 25');
  });
});
