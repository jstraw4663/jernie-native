import { filterVisibleToUser } from '@/src/domain/groups';
import type { Group } from '@/src/types';

interface TestItem {
  id: string;
  groupIds?: string[] | null;
}

const testGroups: Group[] = [
  {
    id: 'group-1',
    tripId: 'trip-1',
    name: 'Hikers',
    memberUids: ['alice', 'bob'],
    createdBy: 'alice',
    createdAt: Date.now(),
  },
  {
    id: 'group-2',
    tripId: 'trip-1',
    name: 'Foodies',
    memberUids: ['bob', 'charlie'],
    createdBy: 'charlie',
    createdAt: Date.now(),
  },
];

const testItems: TestItem[] = [
  { id: 'item-1', groupIds: null },                    // no groups
  { id: 'item-2', groupIds: [] },                      // empty groups
  { id: 'item-3', groupIds: ['group-1'] },            // only hikers group
  { id: 'item-4', groupIds: ['group-2'] },            // only foodies group
  { id: 'item-5', groupIds: ['group-1', 'group-2'] }, // both groups
  { id: 'item-6', groupIds: ['unknown-group'] },      // group that doesn't exist
];

// ── Organizers bypass filtering entirely ──────────────────────────────────────

test('filterVisibleToUser: organizer sees all items regardless of groupIds', () => {
  const result = filterVisibleToUser(testItems, 'alice', testGroups, true);
  expect(result).toHaveLength(6);
  expect(result).toEqual(testItems);
});

// ── No groupIds (always visible) ─────────────────────────────────────────────

test('filterVisibleToUser: items with null groupIds are visible to non-organizer', () => {
  const items = [{ id: 'item-1', groupIds: null }];
  const result = filterVisibleToUser(items, 'alice', testGroups, false);
  expect(result).toHaveLength(1);
  expect(result[0].id).toBe('item-1');
});

test('filterVisibleToUser: items with empty groupIds array are visible to non-organizer', () => {
  const items = [{ id: 'item-2', groupIds: [] }];
  const result = filterVisibleToUser(items, 'alice', testGroups, false);
  expect(result).toHaveLength(1);
  expect(result[0].id).toBe('item-2');
});

// ── User with no uid ─────────────────────────────────────────────────────────

test('filterVisibleToUser: uid: null sees only unrestricted items', () => {
  const result = filterVisibleToUser(testItems, null, testGroups, false);
  expect(result).toHaveLength(2); // only items with null and [] groupIds
  expect(result.map(i => i.id)).toEqual(['item-1', 'item-2']);
});

// ── User member of group(s) ──────────────────────────────────────────────────

test('filterVisibleToUser: user who is member of group-1 sees group-1 items', () => {
  const result = filterVisibleToUser(testItems, 'alice', testGroups, false);
  // alice is in group-1, so she sees:
  // - items with null/[] groupIds (items 1, 2)
  // - items with group-1 (items 3, 5)
  expect(result.map(i => i.id)).toEqual(['item-1', 'item-2', 'item-3', 'item-5']);
});

test('filterVisibleToUser: user who is member of both groups sees both group items', () => {
  const result = filterVisibleToUser(testItems, 'bob', testGroups, false);
  // bob is in group-1 and group-2, so he sees:
  // - items with null/[] groupIds (items 1, 2)
  // - items with group-1 (items 3, 5)
  // - items with group-2 (items 4, 5)
  expect(result.map(i => i.id)).toEqual(['item-1', 'item-2', 'item-3', 'item-4', 'item-5']);
});

// ── User not in any group(s) for an item ────────────────────────────────────

test('filterVisibleToUser: user not in group sees only unrestricted items', () => {
  const result = filterVisibleToUser(testItems, 'david', testGroups, false);
  // david is not in any group, so he sees only unrestricted items
  expect(result.map(i => i.id)).toEqual(['item-1', 'item-2']);
});

// ── Group that doesn't exist in groups array ────────────────────────────────

test('filterVisibleToUser: item with unknown group is hidden from non-organizer users', () => {
  const items = [
    { id: 'item-known', groupIds: ['group-1'] },
    { id: 'item-unknown', groupIds: ['unknown-group'] },
  ];
  const result = filterVisibleToUser(items, 'alice', testGroups, false);
  // alice is in group-1, so sees item-known but not item-unknown
  expect(result.map(i => i.id)).toEqual(['item-known']);
});

test('filterVisibleToUser: item with unknown group is visible to organizer', () => {
  const items = [{ id: 'item-unknown', groupIds: ['unknown-group'] }];
  const result = filterVisibleToUser(items, 'alice', testGroups, true);
  // organizer sees everything
  expect(result).toHaveLength(1);
});

// ── Edge cases ───────────────────────────────────────────────────────────────

test('filterVisibleToUser: empty items array returns empty array', () => {
  const result = filterVisibleToUser([], 'alice', testGroups, false);
  expect(result).toHaveLength(0);
});

test('filterVisibleToUser: empty groups array means user sees only unrestricted items', () => {
  const items = [
    { id: 'item-1', groupIds: null },
    { id: 'item-2', groupIds: ['group-1'] },
  ];
  const result = filterVisibleToUser(items, 'alice', [], false);
  expect(result.map(i => i.id)).toEqual(['item-1']);
});

test('filterVisibleToUser: multiple groupIds on item require matching any one', () => {
  const items = [
    { id: 'item-multi', groupIds: ['unknown-group', 'group-1'] },
  ];
  const result = filterVisibleToUser(items, 'alice', testGroups, false);
  // alice is in group-1, so she sees this item even though it also has unknown-group
  expect(result.map(i => i.id)).toEqual(['item-multi']);
});
