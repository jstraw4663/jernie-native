// Deployed Cloud Functions bundle entrypoint — Firebase deploys every named export
// found here. `enrichPlaces` (Task 4) ties together the Foursquare adapter (Task 2),
// merge logic (Task 3), and the secrets/repository pieces scaffolded in Task 1.
export { enrichPlaces } from './enrichPlaces';
