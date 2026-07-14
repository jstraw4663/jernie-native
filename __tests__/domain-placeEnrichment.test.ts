import { canonicalPlaceKey, resolvePlacePhoto } from '@/src/domain/placeEnrichment';
import type { PlaceEnrichment } from '@/src/types';

describe('canonicalPlaceKey', () => {
  test('produces a slug + rounded lat/lon key', () => {
    expect(canonicalPlaceKey('Eventide Oyster Co.', 43.6591, -70.2568)).toBe('eventide-oyster-co_43.6591_-70.2568');
  });

  test('strips accents', () => {
    expect(canonicalPlaceKey('Café René', 43.65911, -70.25683)).toBe('cafe-rene_43.6591_-70.2568');
  });

  test('lowercases and collapses non-alphanumeric runs into single hyphens', () => {
    expect(canonicalPlaceKey("Luke's  Lobster & Co!!", 43.66, -70.25)).toBe('luke-s-lobster-co_43.6600_-70.2500');
  });

  test('rounds coordinates to 4 decimal places, absorbing small GPS disagreement between providers', () => {
    const a = canonicalPlaceKey('Eventide', 43.659123, -70.256789);
    const b = canonicalPlaceKey('Eventide', 43.659099, -70.256755); // a few meters off
    expect(a).toBe(b);
  });

  test('two different nearby places do not collide', () => {
    const a = canonicalPlaceKey('Eventide', 43.6591, -70.2568);
    const b = canonicalPlaceKey('Fore Street', 43.6595, -70.2571);
    expect(a).not.toBe(b);
  });

  test('trims leading/trailing hyphens from names with leading punctuation', () => {
    expect(canonicalPlaceKey('"The Annex"', 44.38, -68.2)).toBe('the-annex_44.3800_-68.2000');
  });
});

describe('resolvePlacePhoto', () => {
  const ENRICHMENT: PlaceEnrichment = {
    name: 'Eventide', lat: 43.6591, lon: -70.2568, address: '86 Middle St',
    photos: ['https://example.com/enrichment-1.jpg', 'https://example.com/enrichment-2.jpg'],
    cached_at: 1, place_id_locked: true,
  };
  const enrichmentMap = { [canonicalPlaceKey('Eventide', 43.6591, -70.2568)]: ENRICHMENT };

  test('prefers the curated photoUrl when set, even if cached enrichment also has photos', () => {
    const place = { name: 'Eventide', lat: 43.6591, lon: -70.2568, photoUrl: 'https://example.com/curated.jpg' };
    expect(resolvePlacePhoto(place, enrichmentMap)).toBe('https://example.com/curated.jpg');
  });

  test('falls back to the first cached enrichment photo when no curated photoUrl is set', () => {
    const place = { name: 'Eventide', lat: 43.6591, lon: -70.2568, photoUrl: undefined };
    expect(resolvePlacePhoto(place, enrichmentMap)).toBe('https://example.com/enrichment-1.jpg');
  });

  test('returns undefined when neither a curated photoUrl nor cached enrichment exist', () => {
    const place = { name: 'Beehive Trail', lat: 44.34, lon: -68.19, photoUrl: undefined };
    expect(resolvePlacePhoto(place, enrichmentMap)).toBeUndefined();
  });

  test('returns undefined for a place with no known coordinates and no curated photoUrl', () => {
    const place = { name: 'Eventide', lat: undefined, lon: undefined, photoUrl: undefined };
    expect(resolvePlacePhoto(place, enrichmentMap)).toBeUndefined();
  });
});
