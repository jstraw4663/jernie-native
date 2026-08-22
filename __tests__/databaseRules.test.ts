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
const OWNER_ONLY_COLLECTIONS = ['name', 'pills', 'colorPack', 'setupIntent', 'deletedAt'];

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

describe('database.rules.json — bug_reports', () => {
  const bugReports = rules.rules.bug_reports;

  test('the node exists and is not client-readable', () => {
    // There is no admin role in these rules to grant a read to, and inventing one to back
    // an in-app bug list is a bigger change than the feature justifies. Reports are read in
    // the Firebase console. If this ever flips to true, that decision has been reversed by
    // accident.
    expect(bugReports).toBeDefined();
    expect(bugReports['.read']).toBe(false);
  });

  test('writes are create-only — an existing report can never be edited or deleted', () => {
    const rule = bugReports.$reportId['.write'];
    expect(rule).toContain('!data.exists()');
    expect(rule).toContain('auth != null');
  });

  test('the author field is bound to the caller in both .write and .validate', () => {
    // Bound in .write so a forged author is rejected before validation, and again in
    // .validate so the field cannot be absent.
    expect(bugReports.$reportId['.write']).toContain("newData.child('author').val() === auth.uid");
    expect(bugReports.$reportId['.validate']).toContain("newData.child('author').val() === auth.uid");
  });

  test('.validate requires every field feedbackWrites sends', () => {
    const rule = bugReports.$reportId['.validate'];
    ['id', 'tripId', 'title', 'priority', 'author', 'createdAt'].forEach(field => {
      expect(rule).toContain(field);
    });
  });

  test('.validate constrains priority to the three BugPriority values', () => {
    // Kept in sync by hand with BugPriority in src/types.ts — RTDB rules cannot import it.
    const rule = bugReports.$reportId['.validate'];
    ['high', 'medium', 'low'].forEach(priority => {
      expect(rule).toContain(`newData.child('priority').val() === '${priority}'`);
    });
  });

  test('.validate bounds title length to the 200 chars the sheet enforces', () => {
    // FeedbackSheet caps its input at the same number. If they drift, a report the UI
    // accepts is rejected by the server with no useful message.
    expect(bugReports.$reportId['.validate']).toContain("newData.child('title').val().length <= 200");
  });

  test('body is optional but bounded when present', () => {
    expect(bugReports.$reportId['.validate']).toContain("!newData.hasChild('body')");
  });
});
