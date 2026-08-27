import fs from 'fs';
import path from 'path';

// firestore.rules is deployed separately from the functions that depend on it, so a
// collection can exist in code for weeks with no rule at all — and Firestore's default
// for an unmatched path is deny, which fails quietly in exactly the direction that looks
// like "the feature just doesn't work". This asserts the shape of each block rather than
// evaluating the rules (that needs the emulator); what it catches is a collection added
// server-side and never granted a rule, and the quota ledger becoming client-readable.

const rules = fs.readFileSync(path.resolve(__dirname, '..', 'firestore.rules'), 'utf8');

function blockFor(collection: string): string {
  const match = rules.match(new RegExp(`match /${collection}/\\{[^}]+\\} \\{([^}]*)\\}`));
  if (!match) throw new Error(`firestore.rules has no match block for /${collection}`);
  return match[1];
}

// Read-through caches. The client reads these directly so a cache hit costs one Firestore
// read instead of a paid provider call; only the Admin SDK, which bypasses rules, writes.
const CLIENT_READABLE_CACHES = [
  'place_enrichment',
  'trail_enrichment',
  'hotel_enrichment',
  'route_cache',
];

describe('firestore.rules', () => {
  test.each(CLIENT_READABLE_CACHES)('%s is readable by any signed-in user', collection => {
    expect(blockFor(collection)).toContain('allow read: if request.auth != null;');
  });

  test.each(CLIENT_READABLE_CACHES)('%s is never client-writable', collection => {
    expect(blockFor(collection)).toContain('allow write: if false;');
  });

  // The one collection here a client must NOT read. Its per-user docs are dull enough,
  // but the same collection holds the global ledger, which would hand any signed-in
  // caller a live readout of total platform spend — and, more usefully to an attacker,
  // exactly how much headroom is left before the cap bites.
  test('api_quota is invisible to clients entirely', () => {
    expect(blockFor('api_quota')).toContain('allow read, write: if false;');
  });
});
