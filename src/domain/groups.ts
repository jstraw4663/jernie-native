// Domain logic for group-based access control and filtering.

import type { Group } from '@/src/types';

/**
 * Filter items to show only those visible to the current user based on group membership.
 *
 * Rules:
 * - Organizers bypass filtering entirely and see all items
 * - Items with null or empty groupIds are always visible
 * - Non-organizers can only see items whose groupIds (if any) intersect with their group memberships
 * - Users with null uid can only see unrestricted items
 *
 * Generic over both Booking and ItineraryItem types (any object with optional groupIds).
 */
export function filterVisibleToUser<T extends { groupIds?: string[] | null }>(
  items: T[],
  uid: string | null,
  groups: Group[],
  isOrganizer: boolean,
): T[] {
  // Organizers see everything regardless of group membership
  if (isOrganizer) return items;

  // No uid: only see unrestricted items
  if (!uid) return items.filter(i => !i.groupIds || i.groupIds.length === 0);

  // Build set of groups the user is a member of
  const myGroupIds = new Set(groups.filter(g => g.memberUids.includes(uid)).map(g => g.id));

  // Return items that are either unrestricted or have at least one group the user is in
  return items.filter(
    i => !i.groupIds || i.groupIds.length === 0 || i.groupIds.some(id => myGroupIds.has(id)),
  );
}
