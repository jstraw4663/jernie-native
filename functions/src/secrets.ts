// Secret Manager–backed API key access. Never read from a client-side/EXPO_PUBLIC_*
// env var — this key must only ever live server-side, bound to functions that
// explicitly declare it via `runWith`/`{ secrets: [FOURSQUARE_API_KEY] }`.

import { defineSecret } from 'firebase-functions/params';

export const FOURSQUARE_API_KEY = defineSecret('FOURSQUARE_API_KEY');

// Backs the Mapbox provider: Search Box forward search (stop and POI lookup) and the
// Directions API (drive times). A SECRET token (`sk.`), never a public `pk.` one — only
// Cloud Functions use it, so it should never be reachable from a client bundle. The
// separate public token the Maps SDK needs at runtime, and the DOWNLOADS:READ token the
// native build needs, are different credentials and do not belong here.
export const MAPBOX_ACCESS_TOKEN = defineSecret('MAPBOX_ACCESS_TOKEN');
