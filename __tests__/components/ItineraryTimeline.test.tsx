import React from 'react';
import { Text } from 'react-native';
import renderer from 'react-test-renderer';
import {
  ItineraryDateRail, TimelineDayView,
} from '@/src/features/jernie/itinerary';
import type {
  TimelineBand, TimelineDay, TimelineEntry,
} from '@/src/domain/itineraryTimeline';

function render(ui: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  renderer.act(() => { tree = renderer.create(ui); });
  return tree;
}

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
});
