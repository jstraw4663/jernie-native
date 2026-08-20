# Phase 1 — Accounts That Outlive the Device

> Design doc. Roadmap context: Phase 1 of the TestFlight beta roadmap.
> Supersedes section 8 of `../../../../jernie/docs/superpowers/specs/2026-05-29-jernie-native-migration-design.md`
> where the two disagree (noted inline).

## Problem

Every Jernie account is anonymous. A tester who switches phones loses their trip permanently
and unrecoverably.

The anonymous UID is not a placeholder — it is a real Firebase account that genuinely owns the
trip in RTDB, and `linkWithCredential` upgrades it *in place* without copying or overwriting
anything. Storage is therefore not the problem. **Recovery is.** The anonymous credential
lives only in one device's keychain, so after a device change the trip still sits in RTDB,
fully intact, owned by a UID nobody can ever authenticate as again — no email, no proof of
ownership, unreachable permanently. Only linking fixes that. No other beta blocker matters until this
one is closed — an unreliable account makes every other feature untrustworthy.

Secondarily, `authReady` in `src/lib/firebase.ts` is a fire-once module promise. It resolves
on the first authenticated user, unsubscribes, and is awaited by 18 call sites. Linking is
safe because the UID never changes, but **sign-out followed by sign-in as a different user
leaves it holding a stale user forever**. Sign-out is not optional — Apple requires in-app
account deletion, which implies it — so this cannot be deferred past this phase.

## Decisions

Locked with Jeremy during brainstorming:

| Decision | Choice | Consequence |
|---|---|---|
| Providers | **Apple Sign In only** for this beta | Magic link deferred to a Phase 5 call. Every TestFlight tester is on iOS and has an Apple ID, so coverage is 100%. |
| Credential collision | **Block and explain** | No migration Cloud Function. See *Collision* below. |
| Auth position in wizard | **Step 3**, before `createTrip` | Collisions inside the wizard are free — no trip exists yet. |
| Skip / "Save later" | **Skippable, gated at invite** | Anonymous use stays fully functional. Sharing an invite requires a linked account. See *Anonymous durability*. |
| Unlinked trip expiry | **Nudge, never delete** | `anonCreatedAt` drives escalating reminders. Nothing is ever auto-deleted — a 38-day TTL could destroy a tester's itinerary mid-trip. |
| `authReady` replacement | **Re-armable `getAuthedUser()`** | Explicit; ~18 mechanical call-site edits. Rejected alternatives in *Approaches not taken*. |

## Architecture

### `src/lib/firebase.ts` — `getAuthedUser()`

`authReady` is replaced by a function that resolves the current user or waits for the next
one, and re-arms after sign-out:

```ts
let pending: Promise<FirebaseAuthTypes.User> | null = null;

export function getAuthedUser(): Promise<FirebaseAuthTypes.User> {
  const current = auth().currentUser;
  if (current) return Promise.resolve(current);
  if (!pending) {
    pending = new Promise(resolve => {
      const unsub = auth().onAuthStateChanged(u => {
        if (u) { unsub(); pending = null; resolve(u); }
      });
    });
  }
  return pending;
}
```

Caching the in-flight promise means concurrent callers share a single listener. Clearing
`pending` on resolve is what allows a later call — after sign-out — to arm a fresh one.

All 18 `await authReady` sites become `await getAuthedUser()`: `itineraryWrites`,
`bookingWrites`, `tripWrites`, `stopWrites`, `createTrip`, `devSeed`, `useTripData`,
`useJoinTrip`, `useAddStop`, `useUserTrips`.

**Sign-out re-signs-in anonymously.** Every RTDB rule requires `auth != null`, so the app
cannot function unauthenticated. Sign-out therefore lands the user on a fresh anonymous UID
with an empty trip list — the correct signed-out experience, and the transition that proves
the re-arm works.

### `src/contexts/AuthContext.tsx`

Mounted in `app/_layout.tsx` outside `ConnectivityProvider`, absorbing the existing
`initAuth()` effect.

```ts
interface AuthContextValue {
  user: FirebaseAuthTypes.User | null;
  status: 'loading' | 'anonymous' | 'authenticated';
  signInWithApple(): Promise<LinkOutcome>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
}
```

Collision is a **return value, not an exception** — block-and-explain makes it an expected
branch, not an error path:

```ts
type LinkOutcome =
  | { ok: true;  user: FirebaseAuthTypes.User }
  | { ok: false; reason: 'credential-already-in-use'; signIn: () => Promise<void> }
  | { ok: false; reason: 'cancelled' }
  | { ok: false; reason: 'error'; message: string };
```

`signIn` on the collision branch abandons the anonymous UID and signs into the existing
account. The caller decides whether to warn first (see *Collision*).

### Apple credential flow

`expo-apple-authentication` → `signInAsync({ requestedScopes: [FULL_NAME, EMAIL] })` →
`auth.AppleAuthProvider.credential(identityToken, rawNonce)` → `linkWithCredential`.

**Nonce handling is the known footgun.** Generate a random nonce; send its **SHA-256 hash**
to Apple in `signInAsync`; pass the **raw** nonce to Firebase's credential. Reversing these
fails only at runtime, never in tests. `expo-crypto` provides the digest.

### Data model — `users/{uid}`

Gains identity fields beside the existing `trips` index:

```
users/{uid}/
  displayName: string
  email:       string | null    // nullable — see below
  plan:        'anonymous' | 'free' | 'pro'
  anonCreatedAt: number       // written at first anonymous sign-in; drives the save nudge
  linkedAt:    number         // set on link, with plan flipping to 'free'
  trips:       { [tripId]: true }    // existing
```

`database.rules.json` already permits `.read`/`.write` where `$uid === auth.uid`, so no rule
change is required here. `.validate` on this node belongs to Phase 2 with the other content
collections.

**Apple returns name and email only on the first authorization** for a given Apple ID.
Every subsequent sign-in returns null for both, and during development they can only be
obtained again by revoking the app in iOS Settings. The link handler must therefore persist
`displayName`/`email` on first contact and never expect them again. `email` is nullable
because users may hide behind a `privaterelay.appleid.com` relay address.

## Flows

### Step 3 — Save your trip

New `app/onboarding/step-3.tsx`. `step-2.tsx:17` reroutes to it; it continues to step-4.

A **"Save later" skip** is offered in secondary styling — present and unobstructed, but not
competing with the primary action. Skipping leaves the user anonymous and fully functional;
the mechanisms in *Anonymous durability* carry them from there.

The save card previews the trip name and colour. This requires a change: **`createTrip`
currently picks the colour pack randomly inside itself** (`createTrip.ts:41`), so step 3 has
nothing to preview. Pack selection moves up into `OnboardingDraftContext` at wizard start
and is passed into `createTrip` as input. This also removes `Math.random()` from the middle
of a function the tests otherwise pin down, making trip creation deterministic.

The spec's 5-dot progress indicator was never built and is **not** in scope here.

### Anonymous durability

Three mechanisms make skipping safe without ever destroying data.

**`anonCreatedAt`.** Written once to `users/{uid}` at the moment `signInAnonymously()` creates
a new user — inside `initAuth`, on the branch where there was no `currentUser` — alongside
`plan: 'anonymous'`. Naturally write-once per UID, so returning users cost no app-open write.

**The save nudge.** A card in `CTACardZone`. It **cannot** be a phase variant: the router
returns null for `post` and for dismissed `pre` (`CTACardZone.tsx:222-223`), but an unsaved
trip needs nudging in every phase — most of all post-trip, when the trip has become a memory
worth keeping. It therefore sits **above** the phase router as a precedence check: anonymous
and due renders the save card and returns; otherwise control falls through to the existing
logic untouched.

It carries its own snooze state, separate from the existing `isDismissed` boolean which
belongs to the setup card. **Dismiss snoozes rather than kills** — a permanently dismissible
nudge converts nobody. Counted from `anonCreatedAt`:

| Age | Behaviour |
|---|---|
| 0–6 days | Nothing. Don't nag someone still building their trip. |
| 7+ days | Save card, gentle copy. Dismiss snoozes 7 days. |
| 21+ days | Same card, firmer copy. Dismiss snoozes 3 days. |
| Ever | Never deleted. |

Snooze state lives in MMKV keyed by UID — device-scoped, matching the anonymous session it
describes.

**The invite gate.** `profile.tsx`'s share-invite button (`profile.tsx:62`) requires a linked
account. For an anonymous user, tapping it opens the sign-in prompt instead of the share
sheet, with an honest reason: if the organizer's device is lost, the shared trip is orphaned
for *everyone* in it, not only them.

Accepting an invite stays open to anonymous users. Gating the join side would demand sign-in
from someone who just tapped a friend's link and has not yet seen the app — the worst possible
moment to ask. The cost is that an anonymous joiner who loses their device becomes a ghost
member the organizer cannot remove; revisit after the beta if that proves to matter.

### Collision

`linkWithCredential` throws `auth/credential-already-in-use` when the Apple ID already
belongs to another Firebase account. One handler serves both entry points, differing only in
whether it warns first:

- **In the wizard (step 3):** no trip exists yet, so nothing is at risk. Sign into the
  existing account silently and carry the draft on to step 4 — the user is creating a new
  trip either way.
- **From the Profile tab:** the anonymous UID may already own trips. Warn explicitly that
  trips created on this device will stay behind and become unreachable, then let them choose
  between signing into the existing account and cancelling.

The warning is conditional on `users/{uid}/trips` being non-empty, which unifies both cases
under one code path.

### Returning user

No work required. `app/index.tsx` already routes zero trips → onboarding, one trip →
auto-advance into it, many → `(home)`. Firebase restoring the UID on launch is sufficient.

### Profile tab — account section

Current identity (name/email, or "Not signed in"), Sign in with Apple for still-anonymous
users, sign out, and delete account. This is also the path by which **existing anonymous
trips get linked** — including Jeremy's own dev trips.

### Account deletion

Required by App Store review for any app offering account creation. Order matters:

1. Archive owned trips via the existing `archiveTrip`.
2. Remove `users/{uid}`.
3. `user.delete()` **last**.

Deleting the auth user last means a partial failure leaves the user signed in and able to
retry, rather than stranded with an orphaned auth record. `auth/requires-recent-login`
re-prompts Apple and retries.

A true cascade — cleaning `members`, group references, and other travellers' views of a
deleted organizer — needs a Cloud Function and is **out of scope**. To be logged in
`known-issues.md` when deletion ships.

## Prerequisites (blocking — do first)

Nothing in this phase is device-testable until a new EAS dev build lands, so these come
before any UI work and the build bakes while implementation proceeds:

- `expo-apple-authentication` and `expo-crypto` installed; config plugin added to
  `app.config.js`.
- **Sign In with Apple** capability enabled on the `com.jernie.app` identifier in the Apple
  Developer account.
- **Apple provider** enabled in the Firebase console for `jernie-native-dev`.
- A fresh `eas build --profile development --platform ios`.

## Testing

**Unit.** `getAuthedUser()` re-arm behaviour across a sign-out boundary; concurrent callers
sharing one listener; `LinkOutcome` mapping for each Firebase error code; the `users/{uid}`
write shape including null email; deletion ordering (auth user deleted last).
`expo-apple-authentication` is mocked in Jest. 18 existing test files mock `authReady` and
move to `getAuthedUser`.

**On device — requires two devices and two Apple IDs.** These failures are invisible to
single-device, single-account testing, which is the whole reason the phase exists:

1. Anonymous user with existing trips links via Profile → trips survive with the same UID.
2. Fresh install, sign in on a second device → the same trips appear.
3. Wizard step 3 end-to-end, including a collision.
4. Profile collision **with** trips present → warning shown, trips genuinely left behind.
5. Sign out → lands on a fresh anonymous UID with an empty list; a subsequent write succeeds
   (this is the `getAuthedUser` re-arm proving itself).
6. Delete account → trips archived, user removed, re-registration possible.
7. Skip step 3, then link later from Profile → the trip created while anonymous survives on
   the same UID.
8. Anonymous organizer taps share-invite → sign-in prompt, not the share sheet.

Nudge scheduling is unit-tested against an injected clock rather than waited out on device.

## Approaches not taken

- **Thenable `authReady`.** An object with a `.then` that re-arms would keep all 18 call
  sites and all 18 test mocks working untouched. Rejected because `firebase.ts` would then
  export something that looks like a constant but behaves like a function call — a permanent
  puzzle in the file that owns identity. Kept as a schedule escape hatch.
- **Passing `uid` into every write function.** Purer and more testable, but it rewrites every
  write signature and its tests — a refactor wearing an auth phase's clothing, at a cost the
  6–8 week schedule cannot absorb.
- **Full account migration on collision.** Rewriting `ownerUid`, `members` and the user index
  under a target UID is the genuinely correct answer, but `database.rules.json` forbids
  rewriting `ownerUid` (`!data.exists()`), so it needs a Cloud Function and is easily a week
  on its own.
- **Magic link.** Firebase Dynamic Links has shut down, so email-link sign-in on native now
  requires Universal Links plus a hosted page rather than the old built-in path. **The exact
  current requirement must be verified before committing to it.** Deferred to a Phase 5
  decision; no TestFlight tester needs it.

## Out of scope

Automatic deletion of unlinked trips and the scheduled Cloud Function it would need ·
gating the join side of invites · Google Sign-In · magic link · the 5-dot progress indicator ·
full deletion cascade · `.validate` on `users/{uid}` (Phase 2).
