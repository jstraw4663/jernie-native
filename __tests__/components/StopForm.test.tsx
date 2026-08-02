const mockGeocodeCity = jest.fn();
jest.mock('@/src/lib/geocodeClient', () => ({
  geocodeCity: (...args: unknown[]) => mockGeocodeCity(...args),
}));

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
function typeStart(tree: renderer.ReactTestRenderer, text: string) {
  act(() => { tree.root.findByProps({ testID: 'stop-form-start-date' }).props.onChangeText(text); });
}
function typeEnd(tree: renderer.ReactTestRenderer, text: string) {
  act(() => { tree.root.findByProps({ testID: 'stop-form-end-date' }).props.onChangeText(text); });
}
async function pressFind(tree: renderer.ReactTestRenderer) {
  await act(async () => { await tree.root.findByProps({ testID: 'stop-form-find-button' }).props.onPress(); });
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

  test('submit stays disabled after a successful geocode until both dates are present', async () => {
    mockGeocodeCity.mockResolvedValue({ found: true, lat: 43.66, lon: -70.26, city: 'Portland', region: 'ME' });
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Portland, ME');
    await pressFind(tree);
    expect(mockGeocodeCity).toHaveBeenCalledWith('Portland, ME');
    expect(submitDisabled(tree)).toBe(true); // geocoded, but no dates yet

    typeStart(tree, '2026-08-10');
    expect(submitDisabled(tree)).toBe(true); // only start date

    typeEnd(tree, '2026-08-14');
    expect(submitDisabled(tree)).toBe(false); // geocode + both dates → enabled
  });

  test('submit stays disabled when dates are present but geocode was never attempted', () => {
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);
    typeCity(tree, 'Portland, ME');
    typeStart(tree, '2026-08-10');
    typeEnd(tree, '2026-08-14');
    expect(submitDisabled(tree)).toBe(true);
  });

  test('a failed geocode (found: false) shows an inline error and leaves submit disabled', async () => {
    mockGeocodeCity.mockResolvedValue({ found: false });
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Nowhereville');
    typeStart(tree, '2026-08-10');
    typeEnd(tree, '2026-08-14');
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
    typeStart(tree, '2026-08-10');
    typeEnd(tree, '2026-08-14');
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
    typeStart(tree, '2026-08-10');
    typeEnd(tree, '2026-08-14');
    await pressFind(tree);
    expect(submitDisabled(tree)).toBe(false);

    // User edits the city text after the geocode already succeeded — the resolved lat/lon no
    // longer necessarily matches, so submit must be blocked again until re-geocoded.
    typeCity(tree, 'Portland, OR');
    expect(submitDisabled(tree)).toBe(true);
  });

  test('an end date before the start date blocks submit even though both are individually valid', async () => {
    mockGeocodeCity.mockResolvedValue({ found: true, lat: 43.66, lon: -70.26, city: 'Portland', region: 'ME' });
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Portland, ME');
    await pressFind(tree);
    typeStart(tree, '2026-08-14');
    typeEnd(tree, '2026-08-10');

    expect(submitDisabled(tree)).toBe(true);
    expect(JSON.stringify(tree.toJSON())).toContain('End date must be on or after the start date');
  });

  test('a malformed date (not YYYY-MM-DD) blocks submit', async () => {
    mockGeocodeCity.mockResolvedValue({ found: true, lat: 43.66, lon: -70.26, city: 'Portland', region: 'ME' });
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Portland, ME');
    await pressFind(tree);
    typeStart(tree, '08/10/2026');
    typeEnd(tree, '2026-08-14');

    expect(submitDisabled(tree)).toBe(true);
  });

  test('pressing submit when enabled calls onSubmit with exactly the resolved stop shape', async () => {
    mockGeocodeCity.mockResolvedValue({ found: true, lat: 43.66, lon: -70.26, city: 'Portland', region: 'ME' });
    const onSubmit = jest.fn();
    const tree = renderForm(<StopForm onSubmit={onSubmit} />);

    typeCity(tree, 'Portland, ME');
    await pressFind(tree);
    typeStart(tree, '2026-08-10');
    typeEnd(tree, '2026-08-14');
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
    typeStart(tree, '2026-08-10');
    typeEnd(tree, '2026-08-14');
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
    typeStart(tree, '2026-08-10');
    typeEnd(tree, '2026-08-14');
    await pressSubmit(tree);

    expect(JSON.stringify(tree.toJSON())).toContain('database/permission-denied');
    // Still resolved + dated — submit is enabled again so the user can just retry.
    expect(submitDisabled(tree)).toBe(false);
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
