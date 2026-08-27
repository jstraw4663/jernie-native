import {
  canCommit,
  type Candidate,
  type NewItineraryItem,
  type CandidateType,
  buildFieldTable,
  buildCandidate,
} from '@/src/domain/candidate';

// A resolved restaurant candidate, the shape `resolveQuery` returns for "thurston".
// Overrides are split so a test can perturb the itinerary item without having to
// re-narrow the CommitPayload union at the call site.
function makeCandidate(
  overrides: Partial<Candidate> = {},
  itemOverrides: Partial<NewItineraryItem> = {},
): Candidate {
  const item: NewItineraryItem = {
    stopId: 'stop-bar-harbor',
    dateIso: '2026-09-27',
    label: "Thurston's Lobster Pound",
    category: 'restaurant',
    ...itemOverrides,
  };

  return {
    id: 'cand-1',
    type: 'eat',
    typeConfidence: 'explicit',
    identity: {
      name: "Thurston's Lobster Pound",
      subtitle: 'Seafood · 4.6 · Bernard, ME',
      icon: 'fork-knife',
    },
    fields: [],
    commit: {
      target: 'booking',
      booking: {
        stopId: 'stop-bar-harbor',
        type: 'restaurant',
        restaurantName: "Thurston's Lobster Pound",
        date: '2026-09-27',
        time: '7:00 PM',
      },
      item,
    },
    ...overrides,
  };
}

// The design's gate: "Add turns on when title, type, day and stop are all true.
// Amber fields never gate it." The predicate reads `commit`, never `fields`.
describe('canCommit', () => {
  test('a candidate carrying a stop, a day and a title can commit', () => {
    expect(canCommit(makeCandidate())).toBe(true);
  });

  test('a candidate whose itinerary item has no stop cannot commit', () => {
    expect(canCommit(makeCandidate({}, { stopId: '' }))).toBe(false);
  });

  test('a candidate with no day cannot commit', () => {
    expect(canCommit(makeCandidate({}, { dateIso: '' }))).toBe(false);
  });

  test('a candidate whose title is blank cannot commit', () => {
    expect(canCommit(makeCandidate({}, { label: '   ' }))).toBe(false);
  });

  test('a candidate with no title at all cannot commit', () => {
    expect(canCommit(makeCandidate({}, { label: undefined }))).toBe(false);
  });

  test('an amber "wanted" field never blocks the commit', () => {
    const candidate = makeCandidate({
      fields: [
        { key: 'confirmation', label: 'Confirmation', value: null, confidence: 'wanted' },
      ],
    });
    expect(canCommit(candidate)).toBe(true);
  });

  test('an "absent" field never blocks the commit', () => {
    const candidate = makeCandidate({
      fields: [
        { key: 'seat', label: 'Seat', value: null, confidence: 'absent' },
      ],
    });
    expect(canCommit(candidate)).toBe(true);
  });

  test('a fallback candidate keeping the user\'s own words as its title can commit', () => {
    // "grandmas kayak place" — nothing matched, so there is no booking and no place,
    // only a custom itinerary item. It still satisfies title/type/day/stop.
    const candidate = makeCandidate({
      type: 'do',
      typeConfidence: 'fallback',
      identity: { name: 'Grandmas kayak place', subtitle: 'No match', icon: 'compass' },
      commit: {
        target: 'custom',
        item: {
          stopId: 'stop-bar-harbor',
          dateIso: '2026-09-27',
          label: 'Grandmas kayak place',
          category: 'activity',
        },
      },
    });
    expect(canCommit(candidate)).toBe(true);
  });
});

// ── Field tables ─────────────────────────────────────────────────────────────
// "Four rows, declared per type. Mono for pulled values, amber for wanted, grey
// Optional for the rest." The table below is the design's §02 anatomy table.

describe('buildFieldTable', () => {
  test('each type declares the design\'s four rows, in order', () => {
    const labels = (type: CandidateType) => buildFieldTable(type, {}).map(f => f.label);

    expect(labels('flight')).toEqual(['Departs', 'Arrives', 'Seat', 'Confirmation']);
    expect(labels('stay')).toEqual(['Check in', 'Check out', 'Nights', 'Confirmation']);
    expect(labels('do')).toEqual(['Starts', 'Duration', 'Permit', 'Meet at']);
    expect(labels('drive')).toEqual(['Leaves', 'Arrives', 'Stops on the way', 'Driver']);
  });

  test('a supplied value reads as pulled, and keeps its source', () => {
    const [departs] = buildFieldTable('flight', {
      departs: { value: '10:15 · Term B', source: 'foursquare' },
    });

    expect(departs).toMatchObject({
      key: 'departs',
      value: '10:15 · Term B',
      confidence: 'pulled',
      source: 'foursquare',
    });
  });

  test('a value we worked out ourselves reads as inferred, not pulled', () => {
    const [, party] = buildFieldTable('eat', {
      party: { value: '4', source: 'local', inferred: true },
    });

    expect(party).toMatchObject({ key: 'party', value: '4', confidence: 'inferred' });
  });

  test('a missing confirmation code is amber and invites the user to add one', () => {
    const confirmation = buildFieldTable('flight', {}).find(f => f.key === 'confirmation');

    expect(confirmation).toMatchObject({
      value: null,
      confidence: 'wanted',
      placeholder: 'Add code',
    });
  });

  test('a missing optional field is grey and says Optional out loud', () => {
    const meetAt = buildFieldTable('do', {}).find(f => f.key === 'meetAt');

    expect(meetAt).toMatchObject({ value: null, confidence: 'absent', placeholder: 'Optional' });
  });

  test('a field the provider has no answer for says so, rather than inviting input', () => {
    const seat = buildFieldTable('flight', {}).find(f => f.key === 'seat');

    expect(seat).toMatchObject({ confidence: 'absent', placeholder: 'Not in the schedule' });
  });

  // The locked decision on Foursquare's Premium tier: hours are opportunistic. If
  // place_enrichment already holds them the Eat card shows the row; if not, the row is
  // left out entirely rather than rendered as an empty prompt.
  test('the Eat table shows Hours when enrichment supplied them', () => {
    const table = buildFieldTable('eat', {
      hours: { value: 'Sat 11:00 – 20:30', source: 'enrichment' },
    });

    expect(table.map(f => f.label)).toEqual(['Time', 'Party', 'Hours', 'Reservation']);
  });

  test('the Eat table omits Hours entirely when enrichment has none', () => {
    const table = buildFieldTable('eat', {});

    expect(table.map(f => f.label)).toEqual(['Time', 'Party', 'Reservation']);
    expect(table.find(f => f.key === 'hours')).toBeUndefined();
  });
});

// ── buildCandidate ───────────────────────────────────────────────────────────
// Turns what resolveQuery returned into the envelope the sheet renders. This is the one
// translation from provider facts into our own schema, and it lives here rather than in
// the callable because NewBooking/NewPlace live in this project, not in functions/.

const CONTEXT = { stopId: 'stop-bar-harbor', dayIso: '2026-09-27', addedBy: 'uid-jeremy' };

const THURSTONS = {
  name: "Thurston's Lobster Pound",
  lat: 44.2397,
  lon: -68.3531,
  address: '9 Thurston Rd, Bernard, ME 04612',
  category: 'Seafood Restaurant',
  fsq_id: 'fsq-thurstons',
};

let counter = 0;
const fakeId = () => `id-${++counter}`;

function build(overrides: Partial<Parameters<typeof buildCandidate>[0]> = {}) {
  return buildCandidate({
    result: THURSTONS,
    type: 'eat',
    typeConfidence: 'guessed',
    context: CONTEXT,
    query: 'thurston',
    generateId: fakeId,
    ...overrides,
  });
}

describe('buildCandidate — identity', () => {
  test('takes its name from the provider result', () => {
    expect(build().identity.name).toBe("Thurston's Lobster Pound");
  });

  test('keeps the user\'s own words as the title when nothing matched', () => {
    // "No match ... kept your words as the title."
    const candidate = build({
      result: null,
      type: 'do',
      typeConfidence: 'fallback',
      query: 'grandmas kayak place',
    });

    expect(candidate.identity.name).toBe('grandmas kayak place');
  });

  test('carries the provider id and coordinates through', () => {
    expect(build()).toMatchObject({
      fsq_id: 'fsq-thurstons',
      lat: 44.2397,
      lon: -68.3531,
    });
  });

  test('gets a generated, tray-local id', () => {
    expect(build().id).toMatch(/^id-\d+$/);
  });
});

describe('buildCandidate — commit payloads', () => {
  test('an eat candidate commits as a restaurant booking on the chosen day', () => {
    const { commit } = build();

    expect(commit).toMatchObject({
      target: 'booking',
      booking: {
        stopId: 'stop-bar-harbor',
        type: 'restaurant',
        restaurantName: "Thurston's Lobster Pound",
        date: '2026-09-27',
      },
      item: { stopId: 'stop-bar-harbor', dateIso: '2026-09-27' },
    });
  });

  test('a stay candidate commits as a hotel booking, checking out the next day', () => {
    const { commit } = build({ type: 'stay', result: { ...THURSTONS, name: 'Bluenose Inn' } });

    expect(commit).toMatchObject({
      target: 'booking',
      booking: {
        type: 'hotel',
        hotelName: 'Bluenose Inn',
        checkIn: '2026-09-27',
        checkOut: '2026-09-28',
      },
    });
  });

  test('a do candidate commits as a place, with the coordinates enrichment needs', () => {
    const { commit } = build({ type: 'do', result: { ...THURSTONS, name: 'Cadillac Mountain' } });

    expect(commit).toMatchObject({
      target: 'place',
      place: {
        stopId: 'stop-bar-harbor',
        name: 'Cadillac Mountain',
        category: 'activity',
        must: false,
        source: 'community',
        addedBy: 'uid-jeremy',
        lat: 44.2397,
        lon: -68.3531,
      },
    });
  });

  test('a no-match candidate commits as a plain custom item', () => {
    const { commit } = build({ result: null, type: 'do', typeConfidence: 'fallback', query: 'grandmas kayak place' });

    expect(commit).toMatchObject({
      target: 'custom',
      item: { label: 'grandmas kayak place', stopId: 'stop-bar-harbor', dateIso: '2026-09-27' },
    });
  });

  // v1 has no flight or drive provider, so these always land on the manual card — but
  // typed as themselves, so the right field table shows.
  test('a flight commits as a custom item, since no provider filled it in', () => {
    const candidate = build({ result: null, type: 'flight', typeConfidence: 'fallback', query: 'DL 2214' });

    expect(candidate.commit.target).toBe('custom');
    expect(candidate.fields.map(f => f.label)).toEqual(['Departs', 'Arrives', 'Seat', 'Confirmation']);
  });

  test('every built candidate satisfies the Add gate', () => {
    expect(canCommit(build())).toBe(true);
    expect(canCommit(build({ result: null, typeConfidence: 'fallback' }))).toBe(true);
  });
});

describe('buildCandidate — field table', () => {
  test('renders the field table for its own type', () => {
    expect(build({ type: 'do' }).fields.map(f => f.label))
      .toEqual(['Starts', 'Duration', 'Permit', 'Meet at']);
  });

  // The locked decision: hours are opportunistic, read from place_enrichment when it
  // already holds them, never requested from Foursquare at Premium tier.
  test('shows Hours when cached enrichment supplied them', () => {
    const candidate = build({ enrichmentHours: 'Sat 11:00 – 20:30' });

    expect(candidate.fields.find(f => f.key === 'hours')).toMatchObject({
      value: 'Sat 11:00 – 20:30',
      confidence: 'pulled',
      source: 'enrichment',
    });
  });

  test('omits Hours entirely when nothing cached them', () => {
    expect(build().fields.find(f => f.key === 'hours')).toBeUndefined();
  });

  test('a stay infers its dates rather than claiming they were pulled', () => {
    const checkIn = build({ type: 'stay' }).fields.find(f => f.key === 'checkIn');

    expect(checkIn).toMatchObject({ value: '2026-09-27', confidence: 'inferred' });
  });
});
