jest.mock('@react-native-firebase/functions');

import { searchStops, MIN_STOP_QUERY_LENGTH } from '@/src/lib/stopSearchClient';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mockHttpsCallable, mockHttpsCallableRun } = jest.requireMock('@react-native-firebase/functions');

beforeEach(() => {
  jest.clearAllMocks();
});

const CAMDEN = { name: 'Camden', region: 'ME', lat: 44.2098, lon: -69.0648, context: 'Maine, United States' };

describe('searchStops', () => {
  test('calls the searchStops callable and unwraps the result list', async () => {
    mockHttpsCallableRun.mockResolvedValue({ data: { results: [CAMDEN] } });

    const results = await searchStops('camden');

    expect(mockHttpsCallable).toHaveBeenCalledWith('searchStops');
    expect(results).toEqual([CAMDEN]);
  });

  test('trims the query before sending it', async () => {
    mockHttpsCallableRun.mockResolvedValue({ data: { results: [] } });

    await searchStops('  camden  ');

    expect(mockHttpsCallableRun).toHaveBeenCalledWith({ query: 'camden' });
  });

  // The onboarding wizard's first stop has no trip to anchor to, so the key is omitted
  // rather than sent as null — the callable treats a malformed anchor as none anyway, but
  // not sending one keeps the intent legible in the request log.
  test('omits the anchor entirely when there is nothing to anchor to', async () => {
    mockHttpsCallableRun.mockResolvedValue({ data: { results: [] } });

    await searchStops('camden');

    expect(mockHttpsCallableRun).toHaveBeenCalledWith({ query: 'camden' });
  });

  test('passes an anchor through when the caller has one', async () => {
    mockHttpsCallableRun.mockResolvedValue({ data: { results: [] } });

    await searchStops('camden', { lat: 43.6591, lon: -70.2568 });

    expect(mockHttpsCallableRun).toHaveBeenCalledWith({
      query: 'camden',
      near: { lat: 43.6591, lon: -70.2568 },
    });
  });

  // Mirrors resolveClient's MIN_QUERY_LENGTH gate and the callable's own backstop: one or
  // two characters match half the map and cost a billed call to say so.
  test('a query below the minimum never reaches the callable', async () => {
    const results = await searchStops('ca');

    expect(results).toEqual([]);
    expect(mockHttpsCallableRun).not.toHaveBeenCalled();
  });

  test('measures the minimum after trimming', async () => {
    await searchStops('  c  ');

    expect(mockHttpsCallableRun).not.toHaveBeenCalled();
  });

  test('the minimum is the same three characters the callable enforces', () => {
    expect(MIN_STOP_QUERY_LENGTH).toBe(3);
  });

  test('finding nothing is an empty list, not a throw', async () => {
    mockHttpsCallableRun.mockResolvedValue({ data: { results: [] } });

    await expect(searchStops('asdkjfh')).resolves.toEqual([]);
  });

  // A failed lookup and an empty result set are different states in the form — a retry
  // versus a spelling prompt — so a failure must not arrive as emptiness.
  test('a rejected callable propagates rather than being swallowed', async () => {
    mockHttpsCallableRun.mockRejectedValue(new Error('network failure'));

    await expect(searchStops('camden')).rejects.toThrow('network failure');
  });
});
