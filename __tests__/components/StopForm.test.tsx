const mockSearchStops = jest.fn();
jest.mock('@/src/lib/stopSearchClient', () => ({
  searchStops: (...args: unknown[]) => mockSearchStops(...args),
  MIN_STOP_QUERY_LENGTH: 3,
}));

// react-native-calendars' real internals (recyclerlistview, gesture handling, its own
// header/day-cell layout) aren't what this file is testing — mock it down to a thin
// stand-in that forwards props, same philosophy as the searchStops mock above. This keeps
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
import { StopForm, type ResolvedStop } from '@/src/features/jernie/StopForm';

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
// Rows carry indexed testIDs, matching BookingForm's leg rows — react-test-renderer
// surfaces a testID on every composite AND host node beneath a TouchableOpacity (five per
// row), so a shared id could not address one row unambiguously.
function resultRowCount(tree: renderer.ReactTestRenderer): number {
  let count = 0;
  while (tree.root.findAllByProps({ testID: `stop-form-result-${count}` }).length > 0) count++;
  return count;
}
async function pickResult(tree: renderer.ReactTestRenderer, index: number) {
  await act(async () => {
    await tree.root.findAllByProps({ testID: `stop-form-result-${index}` })[0].props.onPress();
  });
}
// A search now resolves nothing on its own, so every journey that needs a resolved stop
// presses Find and then taps a card.
async function findAndPick(tree: renderer.ReactTestRenderer, index = 0) {
  await pressFind(tree);
  await pickResult(tree, index);
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
    mockSearchStops.mockResolvedValue([{ name: 'Portland', region: 'ME', lat: 43.66, lon: -70.26 }]);
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Portland, ME');
    await blurCity(tree);

    expect(mockSearchStops).toHaveBeenCalledWith('Portland, ME');
  });

  test('blurring an empty city field does not trigger a lookup', async () => {
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);
    await blurCity(tree);
    expect(mockSearchStops).not.toHaveBeenCalled();
  });

  test('blurring after an already-fresh geocode does not re-fire a redundant lookup', async () => {
    mockSearchStops.mockResolvedValue([{ name: 'Portland', region: 'ME', lat: 43.66, lon: -70.26 }]);
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Portland, ME');
    await pressFind(tree);
    expect(mockSearchStops).toHaveBeenCalledTimes(1);

    await blurCity(tree);
    expect(mockSearchStops).toHaveBeenCalledTimes(1); // still fresh — no second call
  });

  test('blurring while a lookup is already in flight does not fire a second concurrent call', async () => {
    let resolveSearch!: (value: { name: string; region: string; lat: number; lon: number }[]) => void;
    mockSearchStops.mockReturnValue(new Promise(resolve => { resolveSearch = resolve; }));
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Portland, ME');
    act(() => { tree.root.findByProps({ testID: 'stop-form-find-button' }).props.onPress(); }); // fire, don't await — still in flight
    act(() => { tree.root.findByProps({ testID: 'stop-form-city-input' }).props.onBlur(); });

    expect(mockSearchStops).toHaveBeenCalledTimes(1); // blur skipped it — geocodeStatus was already 'loading'

    await act(async () => { resolveSearch([{ name: 'Portland', region: 'ME', lat: 43.66, lon: -70.26 }]); });
  });

  test('submit stays disabled after a successful geocode until both dates are present', async () => {
    mockSearchStops.mockResolvedValue([{ name: 'Portland', region: 'ME', lat: 43.66, lon: -70.26 }]);
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Portland, ME');
    await findAndPick(tree);
    expect(mockSearchStops).toHaveBeenCalledWith('Portland, ME');
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

  test('a search that matches nothing shows an inline error and leaves submit disabled', async () => {
    mockSearchStops.mockResolvedValue([]);
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Nowhereville');
    pickDay(tree, '2026-08-10');
    pickDay(tree, '2026-08-14');
    await pressFind(tree);

    expect(JSON.stringify(tree.toJSON())).toContain("Couldn't find that city");
    expect(submitDisabled(tree)).toBe(true);
  });

  test('a thrown/rejected geocode call shows an inline error and leaves submit disabled', async () => {
    mockSearchStops.mockRejectedValue(new Error('network failure'));
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Portland, ME');
    await pressFind(tree);

    expect(JSON.stringify(tree.toJSON())).toContain('network failure');
    expect(submitDisabled(tree)).toBe(true);
  });

  test('retry after a failure re-invokes searchStops and can succeed', async () => {
    mockSearchStops.mockResolvedValueOnce([]);
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Portland, ME');
    pickDay(tree, '2026-08-10');
    pickDay(tree, '2026-08-14');
    // The first search matches nothing, so there is no card to tap — that is the failure
    // this test is retrying from.
    await pressFind(tree);
    expect(resultRowCount(tree)).toBe(0);
    expect(submitDisabled(tree)).toBe(true);

    mockSearchStops.mockResolvedValueOnce([{ name: 'Portland', region: 'ME', lat: 43.66, lon: -70.26 }]);
    // The retry button is the same element as Find, just relabeled.
    await findAndPick(tree);

    expect(mockSearchStops).toHaveBeenCalledTimes(2);
    expect(submitDisabled(tree)).toBe(false);
  });

  test('editing the city after a successful geocode invalidates it (stale resolution) and re-disables submit', async () => {
    mockSearchStops.mockResolvedValue([{ name: 'Portland', region: 'ME', lat: 43.66, lon: -70.26 }]);
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Portland, ME');
    pickDay(tree, '2026-08-10');
    pickDay(tree, '2026-08-14');
    await findAndPick(tree);
    expect(submitDisabled(tree)).toBe(false);

    // User edits the city text after the geocode already succeeded — the resolved lat/lon no
    // longer necessarily matches, so submit must be blocked again until re-geocoded.
    typeCity(tree, 'Portland, OR');
    expect(submitDisabled(tree)).toBe(true);
  });

  test('tapping an earlier day after a later one swaps them into the correct start/end order', async () => {
    mockSearchStops.mockResolvedValue([{ name: 'Portland', region: 'ME', lat: 43.66, lon: -70.26 }]);
    const onSubmit = jest.fn();
    const tree = renderForm(<StopForm onSubmit={onSubmit} />);

    typeCity(tree, 'Portland, ME');
    await findAndPick(tree);
    pickDay(tree, '2026-08-14');
    pickDay(tree, '2026-08-10');

    expect(submitDisabled(tree)).toBe(false);
    await pressSubmit(tree);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      dates: { start: '2026-08-10', end: '2026-08-14' },
    }));
  });

  test('a third tap after a full range starts a fresh range rather than extending it', async () => {
    mockSearchStops.mockResolvedValue([{ name: 'Portland', region: 'ME', lat: 43.66, lon: -70.26 }]);
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Portland, ME');
    await findAndPick(tree);
    pickDay(tree, '2026-08-10');
    pickDay(tree, '2026-08-14');
    expect(submitDisabled(tree)).toBe(false);

    // A full range already exists — the next tap starts over rather than becoming a third
    // endpoint of a nonsensical three-day range.
    pickDay(tree, '2026-09-01');
    expect(submitDisabled(tree)).toBe(true); // only the new start date is set now
  });

  test('genuinely valid calendar dates, including a leap-day edge case, still pass validation', async () => {
    mockSearchStops.mockResolvedValue([{ name: 'Portland', region: 'ME', lat: 43.66, lon: -70.26 }]);
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Portland, ME');
    await findAndPick(tree);
    // 2028 is a leap year, so Feb 29 is a real, valid date.
    pickDay(tree, '2028-02-29');
    pickDay(tree, '2028-03-01');

    expect(submitDisabled(tree)).toBe(false);
  });

  test('pressing submit when enabled calls onSubmit with exactly the resolved stop shape', async () => {
    mockSearchStops.mockResolvedValue([{ name: 'Portland', region: 'ME', lat: 43.66, lon: -70.26 }]);
    const onSubmit = jest.fn();
    const tree = renderForm(<StopForm onSubmit={onSubmit} />);

    typeCity(tree, 'Portland, ME');
    await findAndPick(tree);
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

  test('falls back to an empty region when the result carries no region code', async () => {
    mockSearchStops.mockResolvedValue([{ name: 'Some Remote Village', lat: 1, lon: 2 }]); // no city/region in response
    const onSubmit = jest.fn();
    const tree = renderForm(<StopForm onSubmit={onSubmit} />);

    typeCity(tree, 'Some Remote Village');
    await findAndPick(tree);
    pickDay(tree, '2026-08-10');
    pickDay(tree, '2026-08-14');
    await pressSubmit(tree);

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      city: 'Some Remote Village',
      region: '',
    }));
  });

  test('a rejecting onSubmit shows an inline error and re-enables submit without losing the resolved geocode', async () => {
    mockSearchStops.mockResolvedValue([{ name: 'Portland', region: 'ME', lat: 43.66, lon: -70.26 }]);
    const onSubmit = jest.fn().mockRejectedValue(new Error('database/permission-denied'));
    const tree = renderForm(<StopForm onSubmit={onSubmit} />);

    typeCity(tree, 'Portland, ME');
    await findAndPick(tree);
    pickDay(tree, '2026-08-10');
    pickDay(tree, '2026-08-14');
    await pressSubmit(tree);

    expect(JSON.stringify(tree.toJSON())).toContain('database/permission-denied');
    // Still resolved + dated — submit is enabled again so the user can just retry.
    expect(submitDisabled(tree)).toBe(false);
  });

  test('picking a new day after a submit failure clears the stale submit error', async () => {
    mockSearchStops.mockResolvedValue([{ name: 'Portland', region: 'ME', lat: 43.66, lon: -70.26 }]);
    const onSubmit = jest.fn().mockRejectedValue(new Error('database/permission-denied'));
    const tree = renderForm(<StopForm onSubmit={onSubmit} />);

    typeCity(tree, 'Portland, ME');
    await findAndPick(tree);
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
    mockSearchStops.mockResolvedValue([{ name: 'Portland', region: 'ME', lat: 43.66, lon: -70.26 }]);
    const onSubmit = jest.fn().mockRejectedValue(new Error('database/permission-denied'));
    const tree = renderForm(<StopForm onSubmit={onSubmit} />);

    typeCity(tree, 'Portland, ME');
    await findAndPick(tree);
    pickDay(tree, '2026-08-10');
    pickDay(tree, '2026-08-14');
    await pressSubmit(tree);

    expect(JSON.stringify(tree.toJSON())).toContain('database/permission-denied');

    typeCity(tree, 'Portland, MEX');

    expect(JSON.stringify(tree.toJSON())).not.toContain('database/permission-denied');
  });

  test('editing the city field after a geocode failure clears the geocode error (existing behavior stays intact)', async () => {
    mockSearchStops.mockResolvedValue([]);
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

// The point of replacing the single-result geocode. "Portland" is a town in Maine, another
// in Oregon and another in Victoria; the old API resolved that by provider rank and the
// form committed to a city the user never chose, with nothing on screen to say a choice
// had been made at all.
describe('StopForm — choosing between ambiguous matches', () => {
  const PORTLANDS = [
    { name: 'Portland', region: 'ME', lat: 43.6591, lon: -70.2568, context: 'Maine, United States' },
    { name: 'Portland', region: 'OR', lat: 45.5152, lon: -122.6784, context: 'Oregon, United States' },
    { name: 'Portland', region: 'VIC', lat: -38.3453, lon: 141.6045, context: 'Victoria, Australia' },
  ];

  test('renders one row per match, in the order the provider ranked them', async () => {
    mockSearchStops.mockResolvedValue(PORTLANDS);
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Portland');
    await pressFind(tree);

    expect(resultRowCount(tree)).toBe(3);
    const rendered = JSON.stringify(tree.toJSON());
    expect(rendered).toContain('Maine, United States');
    expect(rendered).toContain('Oregon, United States');
    expect(rendered).toContain('Victoria, Australia');
  });

  // The whole bug, stated as a test: several matches must NOT silently resolve to the
  // first one. Submit stays blocked until a human has actually chosen.
  test('an ambiguous search resolves nothing on its own', async () => {
    mockSearchStops.mockResolvedValue(PORTLANDS);
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Portland');
    await pressFind(tree);
    pickDay(tree, '2026-08-10');
    pickDay(tree, '2026-08-14');

    expect(submitDisabled(tree)).toBe(true);
  });

  test('tapping a row resolves that stop, not the top-ranked one', async () => {
    mockSearchStops.mockResolvedValue(PORTLANDS);
    const onSubmit = jest.fn();
    const tree = renderForm(<StopForm onSubmit={onSubmit} />);

    typeCity(tree, 'Portland');
    await pressFind(tree);
    await pickResult(tree, 1);
    pickDay(tree, '2026-08-10');
    pickDay(tree, '2026-08-14');
    await pressSubmit(tree);

    expect(onSubmit).toHaveBeenCalledWith({
      city: 'Portland',
      region: 'OR',
      lat: 45.5152,
      lon: -122.6784,
      dates: { start: '2026-08-10', end: '2026-08-14' },
    });
  });

  test('the list is dismissed once a choice is made', async () => {
    mockSearchStops.mockResolvedValue(PORTLANDS);
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Portland');
    await pressFind(tree);
    await pickResult(tree, 0);

    expect(resultRowCount(tree)).toBe(0);
  });

  // This used to auto-resolve, on the reasoning that one match means nothing to choose
  // between. Live data killed that: an unanchored "camden" returns exactly one result and
  // it is Camden, SOUTH CAROLINA — one result means one result RANKED, not one that
  // exists. Auto-resolving it silently commits the trip to a town the user never saw,
  // which is the precise failure the old single-result geocode had and this replaced.
  //
  // So a single match is shown, not assumed. It costs one tap and makes the choice
  // visible, which is also what makes the flow consistent: every search answers with
  // cards.
  test('a single match is offered as a card rather than resolved silently', async () => {
    mockSearchStops.mockResolvedValue([PORTLANDS[0]]);
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Portland, ME');
    await pressFind(tree);
    pickDay(tree, '2026-08-10');
    pickDay(tree, '2026-08-14');

    expect(resultRowCount(tree)).toBe(1);
    expect(submitDisabled(tree)).toBe(true);
  });

  test('tapping that single card resolves it', async () => {
    mockSearchStops.mockResolvedValue([PORTLANDS[0]]);
    const onSubmit = jest.fn();
    const tree = renderForm(<StopForm onSubmit={onSubmit} />);

    typeCity(tree, 'Portland, ME');
    await pressFind(tree);
    await pickResult(tree, 0);
    pickDay(tree, '2026-08-10');
    pickDay(tree, '2026-08-14');
    await pressSubmit(tree);

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ city: 'Portland', region: 'ME' }));
    expect(resultRowCount(tree)).toBe(0);
  });

  test('editing the city after choosing clears the stale choice and its list', async () => {
    mockSearchStops.mockResolvedValue(PORTLANDS);
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Portland');
    await pressFind(tree);
    await pickResult(tree, 1);
    pickDay(tree, '2026-08-10');
    pickDay(tree, '2026-08-14');
    expect(submitDisabled(tree)).toBe(false);

    typeCity(tree, 'Portsmouth');

    expect(submitDisabled(tree)).toBe(true);
    expect(resultRowCount(tree)).toBe(0);
  });

  // A second search must not leave the first search's rows on screen underneath it.
  test('a fresh search replaces the previous list rather than appending to it', async () => {
    mockSearchStops.mockResolvedValue(PORTLANDS);
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Portland');
    await pressFind(tree);
    expect(resultRowCount(tree)).toBe(3);

    mockSearchStops.mockResolvedValue([PORTLANDS[0], PORTLANDS[1]]);
    typeCity(tree, 'Portlan');
    await pressFind(tree);

    expect(resultRowCount(tree)).toBe(2);
  });

  // Tapping a row blurs the text field, and blur auto-searches. Without a guard the tap
  // fires a second billed lookup and swaps the list out from under the finger that is
  // landing on it — the user chooses a row and gets whatever replaced it.
  test('blurring while choices are on screen does not fire another search', async () => {
    mockSearchStops.mockResolvedValue(PORTLANDS);
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);

    typeCity(tree, 'Portland');
    await pressFind(tree);
    expect(mockSearchStops).toHaveBeenCalledTimes(1);

    await blurCity(tree);

    expect(mockSearchStops).toHaveBeenCalledTimes(1);
    expect(resultRowCount(tree)).toBe(3);
  });

  test('choosing a row after the blur that tapping it causes still resolves that row', async () => {
    mockSearchStops.mockResolvedValue(PORTLANDS);
    const onSubmit = jest.fn();
    const tree = renderForm(<StopForm onSubmit={onSubmit} />);

    typeCity(tree, 'Portland');
    await pressFind(tree);
    await blurCity(tree);
    await pickResult(tree, 2);
    pickDay(tree, '2026-08-10');
    pickDay(tree, '2026-08-14');
    await pressSubmit(tree);

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ region: 'VIC' }));
  });

  test('a row with no region still renders and can be chosen', async () => {
    mockSearchStops.mockResolvedValue([{ name: 'Chamonix', lat: 45.92, lon: 6.87, context: 'France' }]);
    const onSubmit = jest.fn();
    const tree = renderForm(<StopForm onSubmit={onSubmit} />);

    typeCity(tree, 'Chamonix');
    await findAndPick(tree);
    pickDay(tree, '2026-08-10');
    pickDay(tree, '2026-08-14');
    await pressSubmit(tree);

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ city: 'Chamonix', region: '' }));
  });
});

describe('StopForm — edit mode (initialValues)', () => {
  const INITIAL: ResolvedStop = {
    city: 'Portland',
    region: 'ME',
    lat: 43.6,
    lon: -70.2,
    dates: { start: '2026-05-22', end: '2026-05-24' },
  };

  test('seeds city and dates, renders the range, and enables submit without any geocode call', () => {
    const tree = renderForm(<StopForm onSubmit={jest.fn()} initialValues={INITIAL} />);

    expect(tree.root.findByProps({ testID: 'stop-form-city-input' }).props.value).toBe('Portland');
    expect(JSON.stringify(tree.toJSON())).toContain('May 22');
    expect(submitDisabled(tree)).toBe(false);
    expect(mockSearchStops).not.toHaveBeenCalled();
  });

  test('submitting with seeded initialValues calls onSubmit with exactly those values', async () => {
    const onSubmit = jest.fn();
    const tree = renderForm(<StopForm onSubmit={onSubmit} initialValues={INITIAL} />);

    await pressSubmit(tree);

    expect(onSubmit).toHaveBeenCalledWith(INITIAL);
    expect(mockSearchStops).not.toHaveBeenCalled();
  });

  test('editing the seeded city invalidates the resolution until a fresh geocode succeeds', async () => {
    const tree = renderForm(<StopForm onSubmit={jest.fn()} initialValues={INITIAL} />);
    expect(submitDisabled(tree)).toBe(false);

    typeCity(tree, 'Bangor');
    expect(submitDisabled(tree)).toBe(true);

    mockSearchStops.mockResolvedValue([{ name: 'Bangor', region: 'ME', lat: 44.8, lon: -68.77 }]);
    await findAndPick(tree);
    expect(submitDisabled(tree)).toBe(false);
  });

  test('without initialValues, the form still starts empty and idle (unchanged add-mode behavior)', () => {
    const tree = renderForm(<StopForm onSubmit={jest.fn()} />);
    expect(tree.root.findByProps({ testID: 'stop-form-city-input' }).props.value).toBe('');
    expect(submitDisabled(tree)).toBe(true);
    expect(mockSearchStops).not.toHaveBeenCalled();
  });
});
