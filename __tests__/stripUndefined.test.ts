import { stripUndefined } from '@/src/utils/stripUndefined';

test('drops undefined-valued keys', () => {
  const input = { a: 1, b: undefined, c: 'hello' };
  const result = stripUndefined(input);
  expect(result).toEqual({ a: 1, c: 'hello' });
});

test('preserves null-valued keys', () => {
  const input = { a: 1, b: null, c: 'hello' };
  const result = stripUndefined(input);
  expect(result).toEqual({ a: 1, b: null, c: 'hello' });
});

test('preserves falsy-but-defined values', () => {
  const input = { zero: 0, empty: '', false: false, null: null, undefined: undefined };
  const result = stripUndefined(input);
  expect(result).toEqual({ zero: 0, empty: '', false: false, null: null });
});

test('handles empty objects', () => {
  const input = {};
  const result = stripUndefined(input);
  expect(result).toEqual({});
});

test('handles all-undefined objects', () => {
  const input = { a: undefined, b: undefined };
  const result = stripUndefined(input);
  expect(result).toEqual({});
});
