jest.mock('@/src/contexts/TripContext', () => ({ useTripContext: jest.fn() }));

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { ExploreFilterProvider, useExploreFilters } from '@/src/contexts/ExploreFilterContext';
import { useTripContext } from '@/src/contexts/TripContext';
import type { StopWithColor } from '@/src/types';

const mockUseTripContext = useTripContext as jest.Mock;

function makeStop(id: string, start: string, end: string, order = 0): StopWithColor {
  return {
    id,
    tripId: 'trip-1',
    city: id,
    region: 'Region',
    emoji: '',
    lat: 0,
    lon: 0,
    dates: { start, end },
    order,
    color: '#000',
  };
}

type Value = ReturnType<typeof useExploreFilters>;

function Capture({ onCapture }: { onCapture: (v: Value) => void }) {
  onCapture(useExploreFilters());
  return null;
}

/** Mounts the provider with an initial stop list and returns a live getter plus a way to
 *  simulate RTDB handing back a new stop list on the same provider instance. */
function renderProvider(initialStops: StopWithColor[]) {
  mockUseTripContext.mockReturnValue({ stops: initialStops });
  let latest!: Value;
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <ExploreFilterProvider>
        <Capture onCapture={(v) => { latest = v; }} />
      </ExploreFilterProvider>,
    );
  });
  return {
    get: () => latest,
    updateStops: (stops: StopWithColor[]) => {
      mockUseTripContext.mockReturnValue({ stops });
      act(() => {
        tree.update(
          <ExploreFilterProvider>
            <Capture onCapture={(v) => { latest = v; }} />
          </ExploreFilterProvider>,
        );
      });
    },
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-08-25T12:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe('ExploreFilterProvider default stop derivation', () => {
  it('defaults to the stop whose span contains today', () => {
    const stops = [
      makeStop('stop-1', '2026-08-20', '2026-08-24'),
      makeStop('stop-2', '2026-08-24', '2026-08-28'),
    ];
    const { get } = renderProvider(stops);
    expect(get().filters.stopId).toBe('stop-2');
  });

  it('defaults to the next stop when today falls in a gap between stops', () => {
    const stops = [
      makeStop('stop-1', '2026-08-10', '2026-08-15'),
      makeStop('stop-2', '2026-08-28', '2026-09-02'),
    ];
    const { get } = renderProvider(stops);
    // Today (Aug 25) is after stop-1 ends and before stop-2 starts — a gap day, e.g. a
    // travel day between cities — so the default should look ahead to the next stop
    // rather than falling back to 'all'.
    expect(get().filters.stopId).toBe('stop-2');
  });
});

describe('ExploreFilterProvider late-arriving stops', () => {
  it('re-derives the default once the stop list goes from empty to populated', () => {
    const { get, updateStops } = renderProvider([]);
    expect(get().filters.stopId).toBe('all');

    updateStops([makeStop('stop-1', '2026-08-24', '2026-08-28')]);
    expect(get().filters.stopId).toBe('stop-1');
  });

  it('does not re-derive stopId once the traveller has chosen a stop', () => {
    const { get, updateStops } = renderProvider([]);

    act(() => { get().setStop('user-picked'); });
    expect(get().filters.stopId).toBe('user-picked');

    // Stops arrive late, as they do from RTDB — this must not steamroll the traveller's
    // explicit choice, even though it's the same empty-to-populated transition that would
    // otherwise trigger a re-derive.
    updateStops([makeStop('stop-1', '2026-08-24', '2026-08-28')]);
    expect(get().filters.stopId).toBe('user-picked');
  });
});

describe('ExploreFilterProvider reset', () => {
  it('reset returns stopId to the derived default, not to "all"', () => {
    const stops = [makeStop('stop-1', '2026-08-24', '2026-08-28')];
    const { get } = renderProvider(stops);

    act(() => { get().setStop('all'); });
    expect(get().filters.stopId).toBe('all');

    act(() => { get().reset(); });
    expect(get().filters.stopId).toBe('stop-1');
  });
});
