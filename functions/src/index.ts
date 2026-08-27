// Deployed Cloud Functions bundle entrypoint — Firebase deploys every named export
// found here. `enrichPlaces` (Task 4) ties together the Foursquare adapter (Task 2),
// merge logic (Task 3), and the secrets/repository pieces scaffolded in Task 1.
export { enrichPlaces } from './enrichPlaces';

// Free-text stop search (onboarding wizard, Add Stop) via Mapbox Search Box. Replaced
// geocodeCity, whose Google Geocoding call returned exactly one result and so resolved
// "Portland" to Maine or Oregon silently, by rank. This returns the ranked list instead.
export { searchStops } from './searchStops';

// The add sheet's single lookup endpoint — Foursquare place search plus type resolution.
// See functions/src/resolveQuery.ts for why it returns provider facts rather than
// finished candidates.
export { resolveQuery } from './resolveQuery';

// Drive time between two points, cached. Called lazily for the ONE candidate the user
// taps — never per result row, which is the single largest cost lever in the add flow.
export { routeBetween } from './routeBetween';
