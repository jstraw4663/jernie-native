jest.mock('@react-native-firebase/functions');

import { enrichPlaces } from '@/src/lib/enrichmentClient';
import type { PlaceEnrichment } from '@/src/types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mockHttpsCallable, mockHttpsCallableRun } = jest.requireMock('@react-native-firebase/functions');

beforeEach(() => {
  jest.clearAllMocks();
});

const EVENTIDE: PlaceEnrichment = {
  name: 'Eventide Oyster Co.',
  lat: 43.6591,
  lon: -70.2568,
  address: '86 Middle St, Portland, ME',
  photos: [],
  cached_at: 1000,
  place_id_locked: true,
};

describe('enrichPlaces', () => {
  test('calls the enrichPlaces callable with the missing-places payload and unwraps .data.results', async () => {
    mockHttpsCallableRun.mockResolvedValue({ data: { results: { 'eventide_43.6591_-70.2568': EVENTIDE } } });

    const missingPlaces = [
      { canonicalKey: 'eventide_43.6591_-70.2568', name: 'Eventide Oyster Co.', lat: 43.6591, lon: -70.2568 },
    ];
    const result = await enrichPlaces(missingPlaces);

    expect(mockHttpsCallable).toHaveBeenCalledWith('enrichPlaces');
    expect(mockHttpsCallableRun).toHaveBeenCalledWith(missingPlaces);
    expect(result).toEqual({ 'eventide_43.6591_-70.2568': EVENTIDE });
  });

  test('passes an optional fsq_id through untouched', async () => {
    mockHttpsCallableRun.mockResolvedValue({ data: { results: {} } });

    const missingPlaces = [
      { canonicalKey: 'k1', name: 'Some Place', lat: 1, lon: 2, fsq_id: 'fsq-abc' },
    ];
    await enrichPlaces(missingPlaces);

    expect(mockHttpsCallableRun).toHaveBeenCalledWith(missingPlaces);
  });

  test('returns an empty map when the callable reports no results', async () => {
    mockHttpsCallableRun.mockResolvedValue({ data: { results: {} } });
    const result = await enrichPlaces([{ canonicalKey: 'k1', name: 'Nowhere', lat: 0, lon: 0 }]);
    expect(result).toEqual({});
  });

  test('a rejected callable propagates rather than being swallowed', async () => {
    mockHttpsCallableRun.mockRejectedValue(new Error('internal'));
    await expect(
      enrichPlaces([{ canonicalKey: 'k1', name: 'Nowhere', lat: 0, lon: 0 }])
    ).rejects.toThrow('internal');
  });
});
