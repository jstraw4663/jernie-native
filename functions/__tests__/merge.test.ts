import { mergeEnrichment } from '../src/merge';
import type { ProviderMatch } from '../src/providers/types';
import type { PlaceEnrichment } from '../src/types';

const PLACE = { name: 'Eventide Oyster Co.', lat: 43.6591, lon: -70.2568 };

const FULL_MATCH: ProviderMatch = {
  fsq_id: 'fsq-abc123',
  phone: '+12075551234',
  website: 'https://eventideoyster.com',
  hours: ['Mon-Sun 11:00 AM-10:00 PM'],
  address: '86 Middle St, Portland, ME 04101',
  rating: 8.9,
  ratingCount: 512,
  price: '$$',
  photos: ['https://fsq.example.com/photo1.jpg'],
};

const EXISTING: PlaceEnrichment = {
  fsq_id: 'stale-fsq-id',
  googlePlaceId: 'google-place-xyz',
  name: 'Eventide Oyster Co.',
  lat: 43.6591,
  lon: -70.2568,
  phone: '+10000000000',
  website: 'https://old-site.example.com',
  hours: ['stale hours'],
  address: 'stale address',
  rating: 1,
  ratingCount: 1,
  price: '$',
  photos: ['https://old.example.com/photo.jpg'],
  reviews: [{ author: 'A. Reviewer', rating: 5, text: 'Great!', time: 123 }],
  reviews_cached_at: 999,
  cached_at: 111,
  place_id_locked: true,
  fsq_not_found: true,
};

describe('mergeEnrichment', () => {
  describe('match present, existing undefined', () => {
    test('populates all fields from match and place, sets place_id_locked and cached_at', () => {
      const before = Date.now();
      const result = mergeEnrichment(undefined, FULL_MATCH, PLACE);
      const after = Date.now();

      expect(result).toEqual({
        name: PLACE.name,
        lat: PLACE.lat,
        lon: PLACE.lon,
        fsq_id: FULL_MATCH.fsq_id,
        phone: FULL_MATCH.phone,
        website: FULL_MATCH.website,
        hours: FULL_MATCH.hours,
        address: FULL_MATCH.address,
        rating: FULL_MATCH.rating,
        ratingCount: FULL_MATCH.ratingCount,
        price: FULL_MATCH.price,
        photos: FULL_MATCH.photos,
        cached_at: result.cached_at,
        place_id_locked: true,
      });
      expect(result.cached_at).toBeGreaterThanOrEqual(before);
      expect(result.cached_at).toBeLessThanOrEqual(after);
    });

    test('falls back to empty-safe defaults for address/photos when match omits them', () => {
      const sparseMatch: ProviderMatch = { fsq_id: 'fsq-1' };
      const result = mergeEnrichment(undefined, sparseMatch, PLACE);

      expect(result.address).toBe('');
      expect(result.photos).toEqual([]);
    });
  });

  describe('match present, existing present — field-by-field precedence', () => {
    test('every Foursquare Pro/Premium field from match overwrites existing, verbatim', () => {
      const result = mergeEnrichment(EXISTING, FULL_MATCH, PLACE);

      expect(result.fsq_id).toBe(FULL_MATCH.fsq_id);
      expect(result.phone).toBe(FULL_MATCH.phone);
      expect(result.website).toBe(FULL_MATCH.website);
      expect(result.hours).toEqual(FULL_MATCH.hours);
      expect(result.address).toBe(FULL_MATCH.address);
      expect(result.rating).toBe(FULL_MATCH.rating);
      expect(result.ratingCount).toBe(FULL_MATCH.ratingCount);
      expect(result.price).toBe(FULL_MATCH.price);
      expect(result.photos).toEqual(FULL_MATCH.photos);
    });

    test('carries over fields Foursquare does not know about (googlePlaceId, reviews, reviews_cached_at)', () => {
      const result = mergeEnrichment(EXISTING, FULL_MATCH, PLACE);

      expect(result.googlePlaceId).toBe(EXISTING.googlePlaceId);
      expect(result.reviews).toEqual(EXISTING.reviews);
      expect(result.reviews_cached_at).toBe(EXISTING.reviews_cached_at);
    });

    test('clears a stale fsq_not_found sentinel now that a match was found', () => {
      const result = mergeEnrichment(EXISTING, FULL_MATCH, PLACE);

      expect(result.fsq_not_found).toBeUndefined();
    });

    test('always sets place_id_locked: true and refreshes cached_at', () => {
      const before = Date.now();
      const result = mergeEnrichment(EXISTING, FULL_MATCH, PLACE);
      const after = Date.now();

      expect(result.place_id_locked).toBe(true);
      expect(result.cached_at).toBeGreaterThanOrEqual(before);
      expect(result.cached_at).toBeLessThanOrEqual(after);
      expect(result.cached_at).not.toBe(EXISTING.cached_at);
    });

    test('sets identity fields (name/lat/lon) from the place param, not from existing', () => {
      const renamed = { name: 'Eventide Oyster Co. (New Name)', lat: 43.66, lon: -70.26 };
      const result = mergeEnrichment(EXISTING, FULL_MATCH, renamed);

      expect(result.name).toBe(renamed.name);
      expect(result.lat).toBe(renamed.lat);
      expect(result.lon).toBe(renamed.lon);
    });

    test('a field missing from match overwrites (clears) the corresponding existing field', () => {
      const partialMatch: ProviderMatch = { fsq_id: 'fsq-new', address: 'new address', photos: ['new.jpg'] };
      const result = mergeEnrichment(EXISTING, partialMatch, PLACE);

      // Foursquare no longer reports these — the fresh response wins, even though it
      // means clearing a previously-cached value, per the "always overwrite" rule.
      expect(result.phone).toBeUndefined();
      expect(result.website).toBeUndefined();
      expect(result.hours).toBeUndefined();
      expect(result.rating).toBeUndefined();
      expect(result.ratingCount).toBeUndefined();
      expect(result.price).toBeUndefined();
    });

    test('falls back to existing address/photos when match omits them (required-field exception)', () => {
      const partialMatch: ProviderMatch = { fsq_id: 'fsq-new' };
      const result = mergeEnrichment(EXISTING, partialMatch, PLACE);

      expect(result.address).toBe(EXISTING.address);
      expect(result.photos).toEqual(EXISTING.photos);
    });

    test('falls back to existing.fsq_id when a genuine match omits fsq_id, instead of clearing a locked ID', () => {
      const matchWithoutFsqId: ProviderMatch = { address: 'new address', photos: ['new.jpg'] };
      const result = mergeEnrichment(EXISTING, matchWithoutFsqId, PLACE);

      expect(result.fsq_id).toBe(EXISTING.fsq_id);
      expect(result.place_id_locked).toBe(true);
    });
  });

  describe('match === null (clean no-match)', () => {
    test('existing undefined — minimal sentinel shape with empty-safe address/photos', () => {
      const before = Date.now();
      const result = mergeEnrichment(undefined, null, PLACE);
      const after = Date.now();

      expect(result).toEqual({
        name: PLACE.name,
        lat: PLACE.lat,
        lon: PLACE.lon,
        address: '',
        photos: [],
        fsq_not_found: true,
        cached_at: result.cached_at,
        place_id_locked: true,
      });
      expect(result.cached_at).toBeGreaterThanOrEqual(before);
      expect(result.cached_at).toBeLessThanOrEqual(after);
    });

    test('existing present — preserves every existing field, only updating miss bookkeeping', () => {
      const result = mergeEnrichment(EXISTING, null, PLACE);

      expect(result).toEqual({
        ...EXISTING,
        name: PLACE.name,
        lat: PLACE.lat,
        lon: PLACE.lon,
        fsq_not_found: true,
        cached_at: result.cached_at,
        place_id_locked: true,
      });
      expect(result.cached_at).not.toBe(EXISTING.cached_at);
    });

    test('existing present — a Foursquare miss does not wipe fields Foursquare has no opinion on (googlePlaceId, phone, rating, etc.)', () => {
      const result = mergeEnrichment(EXISTING, null, PLACE);

      expect(result.googlePlaceId).toBe(EXISTING.googlePlaceId);
      expect(result.phone).toBe(EXISTING.phone);
      expect(result.website).toBe(EXISTING.website);
      expect(result.hours).toEqual(EXISTING.hours);
      expect(result.rating).toBe(EXISTING.rating);
      expect(result.ratingCount).toBe(EXISTING.ratingCount);
      expect(result.price).toBe(EXISTING.price);
      expect(result.reviews).toEqual(EXISTING.reviews);
      expect(result.reviews_cached_at).toBe(EXISTING.reviews_cached_at);
      expect(result.fsq_id).toBe(EXISTING.fsq_id);
    });
  });

  describe('purity', () => {
    test('does not mutate the existing object', () => {
      const existingCopy = JSON.parse(JSON.stringify(EXISTING));
      mergeEnrichment(EXISTING, FULL_MATCH, PLACE);
      mergeEnrichment(EXISTING, null, PLACE);

      expect(EXISTING).toEqual(existingCopy);
    });

    test('same inputs produce structurally identical output (ignoring the cached_at clock)', () => {
      const a = mergeEnrichment(EXISTING, FULL_MATCH, PLACE);
      const b = mergeEnrichment(EXISTING, FULL_MATCH, PLACE);

      expect({ ...a, cached_at: 0 }).toEqual({ ...b, cached_at: 0 });
    });
  });
});
