// Secret Manager–backed API key access. Never read from a client-side/EXPO_PUBLIC_*
// env var — this key must only ever live server-side, bound to functions that
// explicitly declare it via `runWith`/`{ secrets: [FOURSQUARE_API_KEY] }`.

import { defineSecret } from 'firebase-functions/params';

export const FOURSQUARE_API_KEY = defineSecret('FOURSQUARE_API_KEY');
