// App Check enforcement, as a deploy-time switch rather than a code constant.
//
// WHY A PARAM AND NOT `true`: enforcement rejects any request without a valid App Check
// token. The app does not send one yet — @react-native-firebase/app-check is not
// installed — so hardcoding `true` and deploying would 401 every call and take the app
// down instantly. Firebase's own guidance is to ship the client, watch the App Check
// metrics until real traffic shows valid tokens, and only then enforce.
//
// `enforceAppCheck` accepts an Expression, so this whole rollout is a deploy-time config
// change rather than a code change:
//
//   1. Install and initialise App Check in the app, ship a build.
//   2. Watch Firebase console → App Check → Cloud Functions until verified requests
//      dominate. Anonymous sign-in means real users appear here quickly.
//   3. Flip it, with no code edit and no review:
//        firebase deploy --only functions --set-params ENFORCE_APP_CHECK=true
//
// WHAT THIS DOES AND DOES NOT PROTECT. It stops callers that are not a genuine build of
// this app — the denial-of-wallet case where a leaked auth token is driven from a script.
// It does NOT stop a real user of the real app calling in a loop; that needs a per-uid
// quota, which is a separate piece of work.

import { defineBoolean } from 'firebase-functions/params';

export const ENFORCE_APP_CHECK = defineBoolean('ENFORCE_APP_CHECK', {
  default: false,
  description:
    'Reject callable requests without a valid App Check token. Leave false until the ' +
    'shipped app is sending tokens — see functions/src/appCheck.ts for the rollout order.',
});
