// Shared shape for place-data providers. Foursquare is the only implementation in v1
// (see plan's Global Constraint #1 — no Yelp/Google code anywhere), but the adapter
// contract is kept provider-agnostic so a second provider could implement
// `ProviderAdapter` later without touching the merge logic (Task 3) or callable
// entrypoint (Task 4) that consume it.

export interface ProviderMatch {
  fsq_id?: string;
  phone?: string;
  website?: string;
  hours?: string[];
  address?: string;
  rating?: number;
  ratingCount?: number;
  price?: string;
  photos?: string[];
}

// Contract (binding for every implementation, see functions/src/providers/foursquare.ts
// for the live one):
//   - THROWS on network error, timeout, or any non-2xx HTTP response from the provider.
//   - Returns `null` ONLY for a successful response that found no acceptable match
//     (zero candidates, or the best candidate failed a sanity check e.g. distance).
//   - Never conflates "provider call failed" with "provider says no match" — callers
//     (Task 3/4) rely on that distinction to set the `fsq_not_found` sentinel only on
//     a genuine `null`, not on a thrown error.
export type ProviderAdapter = (input: {
  name: string;
  lat: number;
  lon: number;
  fsq_id?: string;
}) => Promise<ProviderMatch | null>;
