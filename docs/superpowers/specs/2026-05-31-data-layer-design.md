# Jernie Native — Sprint 2b: Data Layer

> Written: May 31, 2026
> Status: **Design complete — ready for implementation plan**
> Author: Jeremy (with Claude)
> Parent spec: `~/jernie/docs/superpowers/specs/2026-05-29-jernie-native-migration-design.md`
> Sprint 2a spec: `docs/superpowers/specs/2026-05-30-jernie-tab-sprint2a-design.md`
> Branch: cut from `feat/jernie-tab` (Sprint 2a must be merged first)

---

## 1. Scope & Goals

Replace all fixture imports in `jernie.tsx` with live Firebase Realtime Database data. Add a `TripContext` that provides trip content and user state to the tab tree. Wire the trip shell layout to load data before rendering tabs.

**In scope:**
- `useTripData` hook — content fetch (`get()` × 4 parallel) + MMKV snapshot cache
- `useTripConfirms` hook — `onValue` real-time listener + optimistic writes
- `TripContext` + `TripProvider` — composes both hooks, owns loading/error/offline-banner render
- `TripLoadingScreen` — gold arc spinner + "jernie" italic, on-brand loading state
- `TripErrorScreen` — blocking error with retry button (shown only when no cache)
- `OfflineBanner` — non-blocking stale-cache indicator
- Trip shell wiring — `[tripId]/_layout.tsx` wraps children in `TripProvider`
- `jernie.tsx` fixture swap — all `DEV_*` replaced with `useTripContext()`

**Out of scope:**
- `reservationTimes`, packing, custom items, or any other user state beyond `confirms`
- Confirms UI (checkboxes) — context exposes `setConfirm` but no component uses it yet
- Explore, Agenda, Profile tabs consuming trip context
- Firestore enrichment (PlaceEnrichment, etc.)
- Write queue integration for confirms (Firebase SDK handles offline buffering natively)

---

## 2. Data Strategy

**Content** (trip metadata, stops, bookings, itinerary): `get()` + MMKV snapshot cache.
**User state** (confirms): `onValue` real-time listener.

This was locked in Sprint 2a §2 as "Option B". The MMKV cache is a pure offline fallback — no freshness TTL, always re-fetches on mount.

---

## 3. New Files

### `src/hooks/useTripData.ts`

Fetches the full trip tree in a single `get()` call after `authReady`, parses all sub-trees from the one snapshot, and caches the result to MMKV.

**Return type:**
```typescript
interface TripDataState {
  trip: Trip | null;
  stops: Stop[];
  bookings: Booking[];
  itinerary: Record<string, ItineraryDay[]>;  // keyed by stopId, sorted by dateIso
  status: 'loading' | 'ready' | 'error';
  fromCache: boolean;
  retry: () => void;
}
```

**MMKV key:** `trip_snapshot_{tripId}`

**Cached shape:**
```typescript
{
  trip: Trip;
  stops: Stop[];
  bookings: Booking[];
  itinerary: Record<string, ItineraryDay[]>;
  cachedAt: number;  // Date.now() — stored for future TTL use, not checked yet
}
```

**Fetch flow:**
1. On mount (and on `retry()`): read MMKV snapshot → if present, set as initial state with `fromCache: true`, `status: 'loading'`
2. Await `authReady` (from `src/lib/firebase.ts`)
3. Single `database().ref('trips/{tripId}').once('value')` — returns full tree
4. Parse sub-trees from the one snapshot: `val.stops`, `val.bookings`, `val.itinerary`; extract Trip metadata fields directly (see §5)
5. Normalize (see §5)
6. Write fresh snapshot to MMKV
7. Set `status: 'ready'`, `fromCache: false`
8. On error: keep existing state unchanged, set `status: 'error'`

**Why single get:** RTDB has no way to fetch only top-level scalar fields without sub-collections, so `get('trips/{tripId}')` always downloads the full tree. Doing additional targeted sub-tree gets would download the same data twice. One round trip is simpler and cheaper.

---

### `src/hooks/useTripConfirms.ts`

Real-time listener for `trips/{tripId}/confirms`.

**Return type:**
```typescript
interface TripConfirmsState {
  confirms: Record<string, boolean>;
  setConfirm: (itemId: string, confirmed: boolean) => void;
}
```

**Read:** `onValue` listener. Null guard: if `snap.val() === null`, keep existing state (path may not exist yet or device is offline). Unsubscribes on unmount.

**Write (`setConfirm`):**
1. Optimistic: update local React state immediately
2. `database().ref('trips/{tripId}/confirms/{itemId}').set(confirmed)` — Firebase SDK buffers offline writes natively; no write queue needed

---

### `src/contexts/TripContext.tsx`

Composes `useTripData` + `useTripConfirms`. Exposes a single context value to consumers. Owns the render decision tree.

**Context value:**
```typescript
interface TripContextValue {
  trip: Trip;                                   // non-null once children render
  stops: Stop[];
  bookings: Booking[];
  itinerary: Record<string, ItineraryDay[]>;
  confirms: Record<string, boolean>;
  setConfirm: (itemId: string, confirmed: boolean) => void;
  fromCache: boolean;
}

export function useTripContext(): TripContextValue  // throws if used outside provider
```

**`TripProvider` render logic:**

| Condition | Renders |
|---|---|
| `status === 'loading'` AND `trip === null` | `<TripLoadingScreen />` |
| `status === 'error'` AND `trip === null` | `<TripErrorScreen onRetry={retry} />` |
| `trip !== null` (ready or cached) | `<TripContext.Provider>` with children + optional `<OfflineBanner>` |

When `trip !== null` and `fromCache === true`, renders `<OfflineBanner onRetry={retry} />` as `position: 'absolute'` overlay at top of screen.

---

### `src/features/jernie/TripLoadingScreen.tsx`

Full-screen loading state shown while the initial fetch runs with no cached data.

**Layout:** `flex: 1`, `backgroundColor: Core.bg`, `alignItems: 'center'`, `justifyContent: 'center'`.

**Arc spinner:**
- 48×48 `Animated.View` (Reanimated)
- `borderRadius: 24`, `borderWidth: 2.5`
- `borderColor: Brand.gold`, `borderTopColor: 'transparent'`
- Continuous rotation: `withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1, false)`

**Label:** 16px below arc, `Typography.roles.h2Italic` (Fraunces italic 22px), `color: Core.textMuted`, text: `"jernie"`.

No progress text, no shimmer, no skeleton. Intentionally minimal.

---

### `src/features/jernie/TripErrorScreen.tsx`

Blocking error state. Shown only when `useTripData` errors AND there is no cached data at all.

**Layout:** same full-screen centered layout as `TripLoadingScreen`.

**Content:**
- Heading: "Couldn't load your trip" — `Typography.roles.h2`, `Core.text`
- Subtext: "Check your connection and try again." — `Typography.roles.body`, `Core.textMuted`
- Button: "Try again" — `Brand.gold` background, `Core.white` text, `Radius.full`, `Spacing.xl` horizontal padding

---

### `OfflineBanner` (inline in `TripContext.tsx`)

Non-blocking stale cache indicator. Shown when rendering cached data after a fetch error.

- `position: 'absolute'`, `top: 0`, full width
- `backgroundColor: Semantic.warningTint`, `paddingVertical: Spacing.sm`, `paddingHorizontal: Spacing.base`
- Text: "Showing saved trip · Tap to retry" — `Typography.roles.meta`, `Semantic.warning`
- `onPress`: calls `retry()`

---

## 4. Modified Files

### `app/(trips)/[tripId]/_layout.tsx`

Add `TripProvider` wrapping `Stack`:

```typescript
import { TripProvider } from '@/src/contexts/TripContext';

export default function TripShellLayout() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  return (
    <NavigationProvider tripId={tripId}>
      <TripProvider tripId={tripId}>
        <Stack screenOptions={{ headerShown: false }} />
      </TripProvider>
    </NavigationProvider>
  );
}
```

### `app/(trips)/[tripId]/(tabs)/jernie.tsx`

Replace all fixture imports with `useTripContext()`. Full replacement map:

| Before | After |
|---|---|
| `import { DEV_TRIP, DEV_STOPS, DEV_BOOKINGS, DEV_ITINERARY }` | `const { trip, stops, bookings, itinerary, confirms, setConfirm } = useTripContext()` |
| `DEV_TRIP` | `trip` |
| `DEV_STOPS` | `stops` |
| `DEV_BOOKINGS` | `bookings` |
| `DEV_ITINERARY[s.id]` | `itinerary[s.id]` |
| `` `cta_dismissed_${DEV_TRIP.id}` `` | `` `cta_dismissed_${trip.id}` `` |
| `bookingsByStop` deps `[]` | `[bookings]` |

`getDevNow()` stays — dev time override is intentional during development.

`confirms` and `setConfirm` are destructured from context but not yet passed to any child component — that wiring is deferred to when confirm UI exists.

---

## 5. RTDB Data Normalization

RTDB returns plain objects; arrays and `id` fields must be derived from keys.

**Stops** (`trips/{tripId}/stops`):
- `snap.val()` → `Record<string, StopRaw>` where `StopRaw` lacks `id`
- `Object.entries(val).map(([id, s]) => ({ ...s, id }))` then sort by `s.order`

**Bookings** (`trips/{tripId}/bookings`):
- Same pattern: inject `id` from key, no sort needed

**Itinerary** (`trips/{tripId}/itinerary`):
- `snap.val()` → `Record<string, Record<string, DayRaw>>` (stopId → dayId → day)
- For each stopId: `Object.entries(days).map(([id, d]) => ({ ...d, id }))` then sort by `dateIso`
- Result: `Record<string, ItineraryDay[]>`

**Trip metadata** (from the root snapshot `val`):
- Extract only the fields matching the `Trip` interface: `id, name, ownerUid, createdAt, pills, inviteToken, colorPack, setupIntent`.
- `val.stops`, `val.bookings`, `val.itinerary` are parsed separately (see above). `val.confirms` is intentionally ignored here — `useTripConfirms` owns that path via `onValue`.

---

## 6. Tests

**New test suites:**
- `useTripData` — mock `database().ref().once()` responses; test: happy path normalization, MMKV cache read/write, error path preserves cached state, retry increments a counter triggering re-fetch
- `useTripConfirms` — mock `onValue`; test: null guard, optimistic update, `setConfirm` calls `database().ref().set()`
- `TripLoadingScreen` / `TripErrorScreen` — snapshot tests only (no logic)

**Existing tests:** all 42 must continue to pass. The fixture swap in `jernie.tsx` does not break any existing tests since they don't render that screen.

---

## 7. Sprint 2c Upgrade Path

| Future addition | Where it hooks in |
|---|---|
| `reservationTimes` | New `useTripReservationTimes` hook, added to `TripContextValue` |
| Confirms UI (checkboxes) | Components call `setConfirm` from `useTripContext()` |
| Other tabs consuming trip data | Call `useTripContext()` — already provided by shell layout |
| Cache TTL / background refresh | Add `cachedAt` freshness check inside `useTripData` |
| `RestaurantBooking` confirm flow | No schema change needed; `confirms` key is `itemId` |
