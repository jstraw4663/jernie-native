// writeQueue.test.ts — unit tests for the offline write queue
// Mocks MMKV storage so tests run in Node without native modules.

jest.mock('react-native-mmkv', () => {
  const store: Record<string, string> = {};
  return {
    createMMKV: jest.fn().mockReturnValue({
      getString: (key: string) => store[key] ?? null,
      set: (key: string, value: string) => { store[key] = value; },
      delete: (key: string) => { delete store[key]; },
    }),
  };
});

import { enqueue, enqueueMany, removeWhere, flush, getQueue } from '@/src/lib/writeQueue';

beforeEach(() => {
  // Reset queue between tests by flushing all
  flush();
});

test('enqueue adds an entry to the queue', () => {
  enqueue('/trips/abc/confirms/item1', true);
  const q = getQueue();
  expect(q).toHaveLength(1);
  expect(q[0].path).toBe('/trips/abc/confirms/item1');
  expect(q[0].value).toBe(true);
});

test('enqueueMany adds multiple entries', () => {
  enqueueMany([
    { path: '/trips/abc/confirms/item1', value: true },
    { path: '/trips/abc/confirms/item2', value: false },
  ]);
  expect(getQueue()).toHaveLength(2);
});

test('removeWhere removes matching entries', () => {
  enqueueMany([
    { path: '/trips/abc/confirms/item1', value: true },
    { path: '/trips/abc/confirms/item2', value: false },
    { path: '/trips/abc/reservationTimes/item1', value: '6:00 PM' },
  ]);
  removeWhere((e) => e.path.includes('confirms'));
  const q = getQueue();
  expect(q).toHaveLength(1);
  expect(q[0].path).toBe('/trips/abc/reservationTimes/item1');
});

test('flush empties the queue', () => {
  enqueue('/trips/abc/confirms/item1', true);
  flush();
  expect(getQueue()).toHaveLength(0);
});

test('enqueue generates unique ids', () => {
  enqueue('/path/a', 1);
  enqueue('/path/b', 2);
  const q = getQueue();
  expect(q[0].id).not.toBe(q[1].id);
});
