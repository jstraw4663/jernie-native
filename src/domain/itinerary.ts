import { stripUndefined } from '@/src/utils/stripUndefined';
import type { ItineraryItem, ItineraryItemCategory } from '@/src/types';

export interface CustomItineraryItemInput {
  label: string;
  time?: string;
  category?: ItineraryItemCategory;
  notes?: string;
}

// Pure builder, mirrors buildAddToItineraryItem (domain/explore.ts) but for free-text
// custom items. Caller supplies `id` to keep this side-effect-free/testable.
export function buildCustomItineraryItem(
  input: CustomItineraryItemInput,
  existingItemsInDay: ItineraryItem[],
  id: string,
): ItineraryItem {
  const order = existingItemsInDay.length > 0
    ? Math.max(...existingItemsInDay.map(i => i.order)) + 1
    : 0;
  return stripUndefined({
    id,
    type: 'custom',
    label: input.label,
    time: input.time,
    category: input.category,
    notes: input.notes,
    order,
  }) as ItineraryItem;
}
