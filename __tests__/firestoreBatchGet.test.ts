jest.mock('@react-native-firebase/firestore');

import { getDocsByIds } from '@/src/lib/firestoreBatchGet';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mockCollection, mockWhere, mockWhereGet, documentId } = jest.requireMock('@react-native-firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
});

function docSnap(id: string, exists: boolean, data?: unknown) {
  return { id, exists: () => exists, data: () => data };
}

interface Widget {
  label: string;
}

describe('getDocsByIds', () => {
  test('returns an empty map without querying when given no ids', async () => {
    const result = await getDocsByIds<Widget>('widgets', []);
    expect(result).toEqual({});
    expect(mockCollection).not.toHaveBeenCalled();
  });

  test('issues a single where(documentId(), in, ids).get() for a batch at or under the chunk limit', async () => {
    mockWhereGet.mockResolvedValue({
      docs: [docSnap('a', true, { label: 'Alpha' }), docSnap('b', true, { label: 'Beta' })],
    });

    const result = await getDocsByIds<Widget>('widgets', ['a', 'b']);

    expect(mockCollection).toHaveBeenCalledWith('widgets');
    expect(mockWhere).toHaveBeenCalledTimes(1);
    expect(mockWhere).toHaveBeenCalledWith(documentId(), 'in', ['a', 'b']);
    expect(result).toEqual({ a: { label: 'Alpha' }, b: { label: 'Beta' } });
  });

  test('chunks a >30-id call into multiple where(...).get() calls and merges the results', async () => {
    const ids = Array.from({ length: 35 }, (_, i) => `id-${i}`);

    mockWhereGet
      .mockResolvedValueOnce({ docs: ids.slice(0, 30).map(id => docSnap(id, true, { label: id })) })
      .mockResolvedValueOnce({ docs: ids.slice(30).map(id => docSnap(id, true, { label: id })) });

    const result = await getDocsByIds<Widget>('widgets', ids);

    expect(mockWhere).toHaveBeenCalledTimes(2);
    expect(mockWhere).toHaveBeenNthCalledWith(1, documentId(), 'in', ids.slice(0, 30));
    expect(mockWhere).toHaveBeenNthCalledWith(2, documentId(), 'in', ids.slice(30));
    expect(Object.keys(result)).toHaveLength(35);
    expect(result['id-0']).toEqual({ label: 'id-0' });
    expect(result['id-34']).toEqual({ label: 'id-34' });
  });

  test('excludes docs that do not exist from the merged result', async () => {
    mockWhereGet.mockResolvedValue({
      docs: [docSnap('a', true, { label: 'Alpha' }), docSnap('missing', false)],
    });

    const result = await getDocsByIds<Widget>('widgets', ['a', 'missing']);

    expect(result).toEqual({ a: { label: 'Alpha' } });
    expect(result).not.toHaveProperty('missing');
  });

  test('a query failure propagates rather than being swallowed', async () => {
    mockWhereGet.mockRejectedValue(new Error('permission-denied'));
    await expect(getDocsByIds<Widget>('widgets', ['a'])).rejects.toThrow('permission-denied');
  });
});
