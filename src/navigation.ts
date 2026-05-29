// Module-level one-shot signal for cross-tab deep-link navigation.
// Explore screen reads and clears this on mount (safe because Expo Router
// re-mounts the tab component on tab switch).

export type FilterId = 'all' | 'restaurant' | 'activity' | 'hike' | 'sight';

export interface ExploreDeepLink {
  filter: FilterId;
  stopId?: string;
}

let pendingLink: ExploreDeepLink | null = null;

export function setExploreDeepLink(link: ExploreDeepLink): void {
  pendingLink = link;
}

export function consumeExploreDeepLink(): ExploreDeepLink | null {
  const link = pendingLink;
  pendingLink = null;
  return link;
}
