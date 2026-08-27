import { classifyProviderCategory, classifyQueryText, resolveType } from '../src/classify';

// The design's type row is instant client UI, but the SERVER owns the override — that is
// what produces "No match. Looks like an activity, so we picked Do". These are the pure
// pieces behind that decision.

describe('classifyProviderCategory', () => {
  test.each([
    ['Seafood Restaurant', 'eat'],
    ['Café', 'eat'],
    ['Cocktail Bar', 'eat'],
    ['Diner', 'eat'],
    ['Pizzeria', 'eat'],
    ['Bakery', 'eat'],
  ])('%s reads as a place to eat', (category, expected) => {
    expect(classifyProviderCategory(category)).toBe(expected);
  });

  test.each([
    ['Hotel', 'stay'],
    ['Bed & Breakfast', 'stay'],
    ['Motel', 'stay'],
    ['Resort', 'stay'],
    ['Inn', 'stay'],
    ['Hostel', 'stay'],
  ])('%s reads as somewhere to stay', (category, expected) => {
    expect(classifyProviderCategory(category)).toBe(expected);
  });

  test.each([
    ['Hiking Trail', 'do'],
    ['Scenic Lookout', 'do'],
    ['Museum', 'do'],
    ['National Park', 'do'],
  ])('%s reads as something to do', (category, expected) => {
    expect(classifyProviderCategory(category)).toBe(expected);
  });

  test('an unknown category falls back to "do"', () => {
    expect(classifyProviderCategory('Wormhole')).toBe('do');
  });

  test('a missing category falls back to "do"', () => {
    expect(classifyProviderCategory(undefined)).toBe('do');
  });

  test('matching is case-insensitive', () => {
    expect(classifyProviderCategory('SEAFOOD RESTAURANT')).toBe('eat');
    expect(classifyProviderCategory('hotel')).toBe('stay');
  });

  // "Inn" as a whole word means lodging; as a substring it is everywhere ("Dinner",
  // "Inner Harbor"), so a naive substring test would send half of Eat to Stay.
  test('does not mistake "inn" inside another word for lodging', () => {
    expect(classifyProviderCategory('Dinner Theater')).toBe('eat');
    expect(classifyProviderCategory('Inner Harbor Overlook')).toBe('do');
  });
});

describe('classifyQueryText', () => {
  test('reads the user\'s own words when no provider matched', () => {
    expect(classifyQueryText('grandmas kayak place')).toBe('do');
  });

  test('picks up an obvious food word', () => {
    expect(classifyQueryText('dinner at the wharf')).toBe('eat');
  });

  test('picks up an obvious lodging word', () => {
    expect(classifyQueryText('bluenose inn')).toBe('stay');
  });

  test('defaults to "do" for anything else', () => {
    expect(classifyQueryText('asdfgh')).toBe('do');
  });
});

// The three confidence states the card renders differently.
describe('resolveType', () => {
  test('a type the user tapped is authoritative', () => {
    expect(resolveType('stay', 'Seafood Restaurant', 'thurston')).toEqual({
      resolvedType: 'stay',
      typeConfidence: 'explicit',
    });
  });

  test('with no tapped type, the provider category decides — and says it guessed', () => {
    expect(resolveType(null, 'Seafood Restaurant', 'thurston')).toEqual({
      resolvedType: 'eat',
      typeConfidence: 'guessed',
    });
  });

  test('with nothing matched at all, it guesses from the query and says so', () => {
    // "No match. Looks like an activity, so we picked Do — kept your words as the title."
    expect(resolveType(null, undefined, 'grandmas kayak place')).toEqual({
      resolvedType: 'do',
      typeConfidence: 'fallback',
    });
  });

  test('a tapped type still wins when nothing matched', () => {
    expect(resolveType('eat', undefined, 'grandmas kayak place')).toEqual({
      resolvedType: 'eat',
      typeConfidence: 'explicit',
    });
  });
});

// v1 has no flight schedule provider, so a flight number cannot resolve to a real card.
// It should still be RECOGNISED, so the manual card it falls back to shows the flight
// field table (Departs · Arrives · Seat · Confirmation) rather than a generic one.
describe('classifyQueryText — flight numbers', () => {
  test.each([
    'DL 2214',
    'DL2214',
    'B6 274',
    'AA1',
    'ua 500',
  ])('%s reads as a flight', (query) => {
    expect(classifyQueryText(query)).toBe('flight');
  });

  test.each([
    'thurston',
    'grandmas kayak place',
    'ME 3',            // a state route, not an airline code
    'DL 22145',        // too many digits for a flight number
  ])('%s does not read as a flight', (query) => {
    expect(classifyQueryText(query)).not.toBe('flight');
  });
});
