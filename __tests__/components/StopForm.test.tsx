const mockGeocodeCity = jest.fn();
jest.mock('@/src/lib/geocodeClient', () => ({
  geocodeCity: (...args: unknown[]) => mockGeocodeCity(...args),
}));

// react-native-calendars' real internals (recyclerlistview, gesture handling, its own
// header/day-cell layout) aren't what this file is testing — mock it down to a thin
// stand-in that forwards props, same philosophy as the geocodeCity mock above. This keeps
// the suite a true unit test of StopForm's own day-press → date-range state machine.
jest.mock('react-native-calendars', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    Calendar: (props: Record<string, unknown>) => ReactActual.createElement(View, props),
  };
});

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { StopForm } from '@/src/features/jernie/StopForm';

function renderForm(ui: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(ui); });
  return tree;
}

function typeCity(tree: renderer.ReactTestRenderer, text: string) {
  act(() => { tree.root.findByProps({ testID: 'stop-form-city-input' }).props.onChangeText(text); });
}
function pickDay(tree: renderer.ReactTestRenderer, dateString: string) {
  act(() => {
    tree.root.findByProps({ testID: 'stop-form-calendar' }).props.onDayPress({
      dateString,
      year: Number(dateString.slice(0, 4)),
      month: Number(dateString.slice(5, 7)),
      day: Number(dateString.slice(8, 10)),
      timestamp: new Date(dateString).getTime(),
    });
  });
}
async function pressFind(tree: renderer.ReactTestRenderer) {
  await act(async () => { await tree.root.findByProps({ testID: 'stop-form-find-button' }).props.onPress(); });
}
async function blurCity(tree: renderer.ReactTestRenderer) {
  await act(async () => { await tree.root.findByProps({ testID: 'stop-form-city-input' }).props.onBlur(); });
}
async function pressSubmit(tree: renderer.ReactTestRenderer) {
  await act(async () => { await tree.root.findByProps({ testID: 'stop-form-submit-button' }).props.onPress(); });
}
function submitDisabled(tree: renderer.ReactTestRenderer): boolean {
  return !!tree.root.findByProps({ testID: 'stop-form-submit-button' }).props.disabled;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('StopForm', () => {
  test('submit is disabled before anything is entered', () => {
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);
    expect(submitDisabled(tree)).toBe(true);
  });

  test('the Find button is disabled until a city is typed', () => {
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);
    expect(tree.root.findByProps({ testID: 'stop-form-find-button' }).props.disabled).toBe(true);
    typeCity(tree, 'Portland, ME');
    expect(tree.root.findByProps({ testID: 'stop-form-find-button' }).props.disabled).toBe(false);
  });

  test('the calendar is configured with today as the minimum selectable date', () => {
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(tree.root.findByProps({ testID: 'stop-form-calendar' }).props.minDate).toBe(expected);
  });

  test('blurring the city field triggers a geocode lookup, same as tapping Find', async () => {
    mockGeocodeCity.mockResolvedValue({ found: true, lat: 43.66, lon: -70.26, city: 'Portland', region: 'ME' });
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Portland, ME');
    await blurCity(tree);

    expect(mockGeocodeCity).toHaveBeenCalledWith('Portland, ME');
  });

  test('blurring an empty city field does not trigger a lookup', async () => {
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);
    await blurCity(tree);
    expect(mockGeocodeCity).not.toHaveBeenCalled();
  });

  test('blurring after an already-fresh geocode does not re-fire a redundant lookup', async () => {
    mockGeocodeCity.mockResolvedValue({ found: true, lat: 43.66, lon: -70.26, city: 'Portland', region: 'ME' });
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Portland, ME');
    await pressFind(tree);
    expect(mockGeocodeCity).toHaveBeenCalledTimes(1);

    await blurCity(tree);
    expect(mockGeocodeCity).toHaveBeenCalledTimes(1); // still fresh — no second call
  });

  test('blurring while a lookup is already in flight does not fire a second concurrent call', async () => {
    let resolveGeocode!: (value: { found: true; lat: number; lon: number; city: string; region: string }) => void;
    mockGeocodeCity.mockReturnValue(new Promise(resolve => { resolveGeocode = resolve; }));
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Portland, ME');
    act(() => { tree.root.findByProps({ testID: 'stop-form-find-button' }).props.onPress(); }); // fire, don't await — still in flight
    act(() => { tree.root.findByProps({ testID: 'stop-form-city-input' }).props.onBlur(); });

    expect(mockGeocodeCity).toHaveBeenCalledTimes(1); // blur skipped it — geocodeStatus was already 'loading'

    await act(async () => { resolveGeocode({ found: true, lat: 43.66, lon: -70.26, city: 'Portland', region: 'ME' }); });
  });

  test('submit stays disabled after a successful geocode until both dates are present', async () => {
    mockGeocodeCity.mockResolvedValue({ found: true, lat: 43.66, lon: -70.26, city: 'Portland', region: 'ME' });
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Portland, ME');
    await pressFind(tree);
    expect(mockGeocodeCity).toHaveBeenCalledWith('Portland, ME');
    expect(submitDisabled(tree)).toBe(true); // geocoded, but no dates yet

    pickDay(tree, '2026-08-10');
    expect(submitDisabled(tree)).toBe(true); // only start date

    pickDay(tree, '2026-08-14');
    expect(submitDisabled(tree)).toBe(false); // geocode + both dates → enabled
  });

  test('submit stays disabled when dates are present but geocode was never attempted', () => {
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);
    typeCity(tree, 'Portland, ME');
    pickDay(tree, '2026-08-10');
    pickDay(tree, '2026-08-14');
    expect(submitDisabled(tree)).toBe(true);
  });

  test('a failed geocode (found: false) shows an inline error and leaves submit disabled', async () => {
    mockGeocodeCity.mockResolvedValue({ found: false });
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Nowhereville');
    pickDay(tree, '2026-08-10');
    pickDay(tree, '2026-08-14');
    await pressFind(tree);

    expect(JSON.stringify(tree.toJSON())).toContain("Couldn't find that city");
    expect(submitDisabled(tree)).toBe(true);
  });

  test('a thrown/rejected geocode call shows an inline error and leaves submit disabled', async () => {
    mockGeocodeCity.mockRejectedValue(new Error('network failure'));
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Portland, ME');
    await pressFind(tree);

    expect(JSON.stringify(tree.toJSON())).toContain('network failure');
    expect(submitDisabled(tree)).toBe(true);
  });

  test('retry after a failure re-invokes geocodeCity and can succeed', async () => {
    mockGeocodeCity.mockResolvedValueOnce({ found: false });
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Portland, ME');
    pickDay(tree, '2026-08-10');
    pickDay(tree, '2026-08-14');
    await pressFind(tree);
    expect(submitDisabled(tree)).toBe(true);

    mockGeocodeCity.mockResolvedValueOnce({ found: true, lat: 43.66, lon: -70.26, city: 'Portland', region: 'ME' });
    // The retry button is the same element as Find, just relabeled.
    await pressFind(tree);

    expect(mockGeocodeCity).toHaveBeenCalledTimes(2);
    expect(submitDisabled(tree)).toBe(false);
  });

  test('editing the city after a successful geocode invalidates it (stale resolution) and re-disables submit', async () => {
    mockGeocodeCity.mockResolvedValue({ found: true, lat: 43.66, lon: -70.26, city: 'Portland', region: 'ME' });
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Portland, ME');
    pickDay(tree, '2026-08-10');
    pickDay(tree, '2026-08-14');
    await pressFind(tree);
    expect(submitDisabled(tree)).toBe(false);

    // User edits the city text after the geocode already succeeded — the resolved lat/lon no
    // longer necessarily matches, so submit must be blocked again until re-geocoded.
    typeCity(tree, 'Portland, OR');
    expect(submitDisabled(tree)).toBe(true);
  });

  test('tapping an earlier day after a later one swaps them into the correct start/end order', async () => {
    mockGeocodeCity.mockResolvedValue({ found: true, lat: 43.66, lon: -70.26, city: 'Portland', region: 'ME' });
    const onSubmit = jest.fn();
    const tree = renderForm(<StopForm onSubmit={onSubmit} />);

    typeCity(tree, 'Portland, ME');
    await pressFind(tree);
    pickDay(tree, '2026-08-14');
    pickDay(tree, '2026-08-10');

    expect(submitDisabled(tree)).toBe(false);
    await pressSubmit(tree);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      dates: { start: '2026-08-10', end: '2026-08-14' },
    }));
  });

  test('a third tap after a full range starts a fresh range rather than extending it', async () => {
    mockGeocodeCity.mockResolvedValue({ found: true, lat: 43.66, lon: -70.26, city: 'Portland', region: 'ME' });
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Portland, ME');
    await pressFind(tree);
    pickDay(tree, '2026-08-10');
    pickDay(tree, '2026-08-14');
    expect(submitDisabled(tree)).toBe(false);

    // A full range already exists — the next tap starts over rather than becoming a third
    // endpoint of a nonsensical three-day range.
    pickDay(tree, '2026-09-01');
    expect(submitDisabled(tree)).toBe(true); // only the new start date is set now
  });

  test('genuinely valid calendar dates, including a leap-day edge case, still pass validation', async () => {
    mockGeocodeCity.mockResolvedValue({ found: true, lat: 43.66, lon: -70.26, city: 'Portland', region: 'ME' });
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Portland, ME');
    await pressFind(tree);
    // 2028 is a leap year, so Feb 29 is a real, valid date.
    pickDay(tree, '2028-02-29');
    pickDay(tree, '2028-03-01');

    expect(submitDisabled(tree)).toBe(false);
  });

  test('pressing submit when enabled calls onSubmit with exactly the resolved stop shape', async () => {
    mockGeocodeCity.mockResolvedValue({ found: true, lat: 43.66, lon: -70.26, city: 'Portland', region: 'ME' });
    const onSubmit = jest.fn();
    const tree = renderForm(<StopForm onSubmit={onSubmit} />);

    typeCity(tree, 'Portland, ME');
    await pressFind(tree);
    pickDay(tree, '2026-08-10');
    pickDay(tree, '2026-08-14');
    await pressSubmit(tree);

    expect(onSubmit).toHaveBeenCalledWith({
      city: 'Portland',
      region: 'ME',
      lat: 43.66,
      lon: -70.26,
      dates: { start: '2026-08-10', end: '2026-08-14' },
    });
  });

  test('falls back to the typed query as city, and empty string as region, when the geocoder omits them', async () => {
    mockGeocodeCity.mockResolvedValue({ found: true, lat: 1, lon: 2 }); // no city/region in response
    const onSubmit = jest.fn();
    const tree = renderForm(<StopForm onSubmit={onSubmit} />);

    typeCity(tree, 'Some Remote Village');
    await pressFind(tree);
    pickDay(tree, '2026-08-10');
    pickDay(tree, '2026-08-14');
    await pressSubmit(tree);

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      city: 'Some Remote Village',
      region: '',
    }));
  });

  test('a rejecting onSubmit shows an inline error and re-enables submit without losing the resolved geocode', async () => {
    mockGeocodeCity.mockResolvedValue({ found: true, lat: 43.66, lon: -70.26, city: 'Portland', region: 'ME' });
    const onSubmit = jest.fn().mockRejectedValue(new Error('database/permission-denied'));
    const tree = renderForm(<StopForm onSubmit={onSubmit} />);

    typeCity(tree, 'Portland, ME');
    await pressFind(tree);
    pickDay(tree, '2026-08-10');
    pickDay(tree, '2026-08-14');
    await pressSubmit(tree);

    expect(JSON.stringify(tree.toJSON())).toContain('database/permission-denied');
    // Still resolved + dated — submit is enabled again so the user can just retry.
    expect(submitDisabled(tree)).toBe(false);
  });

  test('picking a new day after a submit failure clears the stale submit error', async () => {
    mockGeocodeCity.mockResolvedValue({ found: true, lat: 43.66, lon: -70.26, city: 'Portland', region: 'ME' });
    const onSubmit = jest.fn().mockRejectedValue(new Error('database/permission-denied'));
    const tree = renderForm(<StopForm onSubmit={onSubmit} />);

    typeCity(tree, 'Portland, ME');
    await pressFind(tree);
    pickDay(tree, '2026-08-10');
    pickDay(tree, '2026-08-14');
    await pressSubmit(tree);

    expect(JSON.stringify(tree.toJSON())).toContain('database/permission-denied');

    // Picking a new day after the failed submit is the user starting a correction — the old
    // failure message shouldn't linger and imply nothing has changed.
    pickDay(tree, '2026-08-20');

    expect(JSON.stringify(tree.toJSON())).not.toContain('database/permission-denied');
  });

  test('editing the city field after a submit failure clears the stale submit error', async () => {
    mockGeocodeCity.mockResolvedValue({ found: true, lat: 43.66, lon: -70.26, city: 'Portland', region: 'ME' });
    const onSubmit = jest.fn().mockRejectedValue(new Error('database/permission-denied'));
    const tree = renderForm(<StopForm onSubmit={onSubmit} />);

    typeCity(tree, 'Portland, ME');
    await pressFind(tree);
    pickDay(tree, '2026-08-10');
    pickDay(tree, '2026-08-14');
    await pressSubmit(tree);

    expect(JSON.stringify(tree.toJSON())).toContain('database/permission-denied');

    typeCity(tree, 'Portland, MEX');

    expect(JSON.stringify(tree.toJSON())).not.toContain('database/permission-denied');
  });

  test('editing the city field after a geocode failure clears the geocode error (existing behavior stays intact)', async () => {
    mockGeocodeCity.mockResolvedValue({ found: false });
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Nowhereville');
    await pressFind(tree);
    expect(JSON.stringify(tree.toJSON())).toContain("Couldn't find that city");

    typeCity(tree, 'Nowhereville, Real Edition');

    expect(JSON.stringify(tree.toJSON())).not.toContain("Couldn't find that city");
  });

  test('no Cancel button is rendered when onCancel is not provided', () => {
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);
    expect(tree.root.findAllByProps({ testID: 'stop-form-cancel-button' })).toHaveLength(0);
  });

  test('Cancel button calls onCancel when provided', () => {
    const onCancel = jest.fn();
    const tree = renderForm(<StopForm onSubmit={jest.fn()} onCancel={onCancel} />);
    act(() => { tree.root.findByProps({ testID: 'stop-form-cancel-button' }).props.onPress(); });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test('submitLabel customizes the submit button text', () => {
    const tree = renderForm(<StopForm onSubmit={jest.fn()} submitLabel="Add stop" />);
    expect(JSON.stringify(tree.toJSON())).toContain('Add stop');
  });
});
