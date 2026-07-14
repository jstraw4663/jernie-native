import {
  isValidLegacyRecord,
  mapLegacyRecord,
  buildMigration,
  type LegacyPlaceEnrichment,
} from '@/scripts/importFirestoreEnrichment.transform';

const VALID_RECORD: LegacyPlaceEnrichment = {
  google_place_id: 'ChIJ_google_123',
  lat: 43.6591,
  lon: -70.2568,
  phone: '(207) 774-8538',
  website: 'https://eventideoysterco.com',
  hours: ['Mon-Sun 11am-10pm'],
  addr: '86 Middle St, Portland, ME',
  rating: 4.6,
  user_ratings_total: 3200,
  price_level: '$$$',
  photos: ['https://example.com/photo1.jpg'],
  reviews: [{ author: 'Alex', rating: 5, text: 'Great!', time: 1000 }],
  reviews_cached_at: 2000,
  cached_at: 1000,
};

describe('isValidLegacyRecord', () => {
  test('accepts a record with lat/lon/google_place_id', () => {
    expect(isValidLegacyRecord(VALID_RECORD)).toBe(true);
  });

  test('rejects null/undefined', () => {
    expect(isValidLegacyRecord(null)).toBe(false);
    expect(isValidLegacyRecord(undefined)).toBe(false);
  });

  test('rejects a record missing lat/lon', () => {
    expect(isValidLegacyRecord({ google_place_id: 'x' })).toBe(false);
  });

  test('rejects a record with no resolved google_place_id — cannot be deduped without a stable provider ID', () => {
    const { google_place_id, ...rest } = VALID_RECORD;
    void google_place_id;
    expect(isValidLegacyRecord(rest)).toBe(false);
  });
});

describe('mapLegacyRecord', () => {
  test('maps google_place_id to googlePlaceId, leaves fsq_id unset', () => {
    const mapped = mapLegacyRecord(VALID_RECORD, 'Eventide Oyster Co.');
    expect(mapped.googlePlaceId).toBe('ChIJ_google_123');
    expect(mapped.fsq_id).toBeUndefined();
  });

  test('uses the caller-supplied name (legacy docs mostly do not carry their own)', () => {
    expect(mapLegacyRecord(VALID_RECORD, 'Eventide Oyster Co.').name).toBe('Eventide Oyster Co.');
  });

  test('maps addr->address, user_ratings_total->ratingCount, price_level->price', () => {
    const mapped = mapLegacyRecord(VALID_RECORD, 'Eventide Oyster Co.');
    expect(mapped.address).toBe('86 Middle St, Portland, ME');
    expect(mapped.ratingCount).toBe(3200);
    expect(mapped.price).toBe('$$$');
  });

  test('carries over rating/hours/photos/reviews as-is', () => {
    const mapped = mapLegacyRecord(VALID_RECORD, 'Eventide Oyster Co.');
    expect(mapped.rating).toBe(4.6);
    expect(mapped.hours).toEqual(['Mon-Sun 11am-10pm']);
    expect(mapped.photos).toEqual(['https://example.com/photo1.jpg']);
    expect(mapped.reviews).toEqual(VALID_RECORD.reviews);
  });

  test('always sets place_id_locked: true', () => {
    expect(mapLegacyRecord(VALID_RECORD, 'X').place_id_locked).toBe(true);
  });

  test('defaults photos to an empty array and address to "" when absent', () => {
    const { photos, addr, ...rest } = VALID_RECORD;
    void photos; void addr;
    const mapped = mapLegacyRecord(rest as LegacyPlaceEnrichment, 'X');
    expect(mapped.photos).toEqual([]);
    expect(mapped.address).toBe('');
  });

  test('omits optional fields entirely (not as undefined) when the legacy record lacks them', () => {
    const { phone, website, rating, ...rest } = VALID_RECORD;
    void phone; void website; void rating;
    const mapped = mapLegacyRecord(rest as LegacyPlaceEnrichment, 'X');
    expect('phone' in mapped).toBe(false);
    expect('website' in mapped).toBe(false);
    expect('rating' in mapped).toBe(false);
  });

  test('null-valued optional fields (Firestore stores explicit nulls) are also omitted, not passed through as null', () => {
    const withNulls: LegacyPlaceEnrichment = { ...VALID_RECORD, rating: null, hours: null };
    const mapped = mapLegacyRecord(withNulls, 'X');
    expect('rating' in mapped).toBe(false);
    expect('hours' in mapped).toBe(false);
  });
});

describe('buildMigration', () => {
  test('copies valid records with a matching RTDB place, computing a canonical key', () => {
    const result = buildMigration(
      { 'place-a': VALID_RECORD },
      { 'place-a': 'Eventide Oyster Co.' },
    );
    expect(result.copied).toHaveLength(1);
    expect(result.copied[0].rtdbPlaceId).toBe('place-a');
    expect(result.copied[0].canonicalKey).toBe('eventide-oyster-co_43.6591_-70.2568');
    expect(result.copied[0].enrichment.name).toBe('Eventide Oyster Co.');
  });

  test('skips a legacy doc with no matching RTDB place (e.g. a hotel-booking enrichment doc)', () => {
    const result = buildMigration(
      { 'book-hotel-1': VALID_RECORD },
      {}, // no RTDB place named for this id
    );
    expect(result.copied).toEqual([]);
    expect(result.skipped).toEqual(['book-hotel-1']);
  });

  test('skips an invalid record even when a matching RTDB place name exists', () => {
    const { google_place_id, ...invalid } = VALID_RECORD;
    void google_place_id;
    const result = buildMigration(
      { 'place-a': invalid },
      { 'place-a': 'Eventide Oyster Co.' },
    );
    expect(result.copied).toEqual([]);
    expect(result.skipped).toEqual(['place-a']);
  });

  test('empty input produces empty output', () => {
    expect(buildMigration({}, {})).toEqual({ copied: [], skipped: [] });
  });
});
