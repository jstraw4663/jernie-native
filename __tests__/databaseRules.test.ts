import fs from 'fs';
import path from 'path';

// database.rules.json has no macro/include system, so the owner-or-member and
// owner-only write-rule expressions are necessarily repeated verbatim across every
// collection that needs them. Nothing enforces that those copies stay in sync — this
// test exists purely to catch future drift (someone editing one copy and not the
// others) rather than to validate the rules themselves.

const rulesPath = path.resolve(__dirname, '..', 'database.rules.json');
const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
const tripRules = rules.rules.trips.$tripId;

const MEMBER_WRITABLE_COLLECTIONS = ['stops', 'bookings', 'itinerary', 'confirms', 'reservationTimes', 'places'];
const OWNER_ONLY_COLLECTIONS = ['name', 'pills', 'colorPack', 'setupIntent'];

function writeRuleFor(collection: string): string {
  const rule = tripRules[collection]?.['.write'];
  if (typeof rule !== 'string') {
    throw new Error(`Expected trips/$tripId/${collection} to have a string .write rule`);
  }
  return rule;
}

describe('database.rules.json — duplicated write-rule expressions stay in sync', () => {
  test('the owner-or-member expression is identical across all member-writable collections', () => {
    const [first, ...rest] = MEMBER_WRITABLE_COLLECTIONS.map(writeRuleFor);
    rest.forEach((rule, i) => {
      expect(rule).toBe(first);
      if (rule !== first) {
        throw new Error(`trips/$tripId/${MEMBER_WRITABLE_COLLECTIONS[i + 1]}'s .write rule has drifted from trips/$tripId/${MEMBER_WRITABLE_COLLECTIONS[0]}'s`);
      }
    });
  });

  test('the owner-only expression is identical across all owner-only collections', () => {
    const [first, ...rest] = OWNER_ONLY_COLLECTIONS.map(writeRuleFor);
    rest.forEach((rule, i) => {
      expect(rule).toBe(first);
      if (rule !== first) {
        throw new Error(`trips/$tripId/${OWNER_ONLY_COLLECTIONS[i + 1]}'s .write rule has drifted from trips/$tripId/${OWNER_ONLY_COLLECTIONS[0]}'s`);
      }
    });
  });

  test('the owner-or-member and owner-only expressions are not accidentally identical to each other', () => {
    // Sanity check that these are actually two distinct rule tiers, not a copy-paste
    // that made every collection owner-only (which would silently break member writes).
    expect(writeRuleFor(MEMBER_WRITABLE_COLLECTIONS[0])).not.toBe(writeRuleFor(OWNER_ONLY_COLLECTIONS[0]));
  });
});
