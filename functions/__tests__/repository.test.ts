import { getFirestore } from 'firebase-admin/firestore';
import { getEnrichment, writeEnrichment } from '../src/repository';
import type { PlaceEnrichment } from '../src/types';

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(),
}));

const mockGetFirestore = getFirestore as jest.MockedFunction<typeof getFirestore>;

describe('repository', () => {
  const mockGet = jest.fn();
  const mockSet = jest.fn();
  const mockDoc = jest.fn(() => ({ get: mockGet, set: mockSet }));
  const mockCollection = jest.fn(() => ({ doc: mockDoc }));

  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetFirestore.mockReturnValue({ collection: mockCollection } as any);
  });

  describe('getEnrichment', () => {
    test('reads place_enrichment/{canonicalKey} and returns the doc data when it exists', async () => {
      const stored = { name: 'Test Place', lat: 45, lon: -70 };
      mockGet.mockResolvedValue({ exists: true, data: () => stored });

      const result = await getEnrichment('test-place_45.0000_-70.0000');

      expect(mockCollection).toHaveBeenCalledWith('place_enrichment');
      expect(mockDoc).toHaveBeenCalledWith('test-place_45.0000_-70.0000');
      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(result).toEqual(stored);
    });

    test('returns undefined when the doc does not exist', async () => {
      mockGet.mockResolvedValue({ exists: false, data: () => undefined });

      const result = await getEnrichment('missing-key_0.0000_0.0000');

      expect(mockCollection).toHaveBeenCalledWith('place_enrichment');
      expect(mockDoc).toHaveBeenCalledWith('missing-key_0.0000_0.0000');
      expect(result).toBeUndefined();
    });
  });

  describe('writeEnrichment', () => {
    test('writes to place_enrichment/{canonicalKey} with the given data', async () => {
      const data: PlaceEnrichment = {
        name: 'Test Place',
        lat: 45,
        lon: -70,
        address: '123 Main St',
        photos: [],
        cached_at: 1_700_000_000_000,
        place_id_locked: true,
      };
      mockSet.mockResolvedValue(undefined);

      await writeEnrichment('test-place_45.0000_-70.0000', data);

      expect(mockCollection).toHaveBeenCalledWith('place_enrichment');
      expect(mockDoc).toHaveBeenCalledWith('test-place_45.0000_-70.0000');
      expect(mockSet).toHaveBeenCalledWith(data);
    });
  });
});
