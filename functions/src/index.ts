// Deployed Cloud Functions bundle entrypoint — Firebase deploys every named export
// found here. `enrichPlaces` (Task 4) ties together the Foursquare adapter (Task 2),
// merge logic (Task 3), and the secrets/repository pieces scaffolded in Task 1.
export { enrichPlaces } from './enrichPlaces';

// Resolves free-text city input (onboarding wizard, Add Stop) to lat/lon/city/region
// via Google's Geocoding API — see the onboarding-wizard-mvp plan's Task 1.
export { geocodeCity } from './geocodeCity';
