jest.mock('@react-native-firebase/functions');

import { geocodeCity } from '@/src/lib/geocodeClient';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mockHttpsCallable, mockHttpsCallableRun } = jest.requireMock('@react-native-firebase/functions');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('geocodeCity', () => {
  test('calls the geocodeCity callable with the query payload and unwraps .data', async () => {
    mockHttpsCallableRun.mockResolvedValue({
      data: { found: true, lat: 43.6591, lon: -70.2568, city: 'Portland', region: 'ME' },
    });

    const result = await geocodeCity('Portland, ME');

    expect(mockHttpsCallable).toHaveBeenCalledWith('geocodeCity');
    expect(mockHttpsCallableRun).toHaveBeenCalledWith({ query: 'Portland, ME' });
    expect(result).toEqual({ found: true, lat: 43.6591, lon: -70.2568, city: 'Portland', region: 'ME' });
  });

  test('returns a found result with optional city and region fields', async () => {
    mockHttpsCallableRun.mockResolvedValue({
      data: { found: true, lat: 1, lon: 2 },
    });

    const result = await geocodeCity('Unknown Place');

    expect(result).toEqual({ found: true, lat: 1, lon: 2 });
  });

  test('returns a not-found result when the geocoding lookup matches no place', async () => {
    mockHttpsCallableRun.mockResolvedValue({ data: { found: false } });

    const result = await geocodeCity('Nowhere Planet');

    expect(result).toEqual({ found: false });
  });

  test('a rejected callable propagates rather than being swallowed', async () => {
    mockHttpsCallableRun.mockRejectedValue(new Error('network failure'));
    await expect(geocodeCity('Portland, ME')).rejects.toThrow('network failure');
  });
});
