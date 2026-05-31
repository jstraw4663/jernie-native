# Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixture imports in `jernie.tsx` with live Firebase RTDB data via `useTripData`, `useTripConfirms`, and `TripContext`.

**Architecture:** `useTripData` fetches the full trip tree with a single `get()` call + MMKV snapshot cache for offline fallback. `useTripConfirms` uses `onValue` for real-time confirm state + optimistic writes. `TripProvider` composes both hooks and owns the loading/error/offline-banner render decision.

**Tech Stack:** `@react-native-firebase/database` v24, `react-native-mmkv` v4, Reanimated v4, Expo Router v4, Jest + `@testing-library/react-native`

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/hooks/useTripData.ts` | Content fetch + MMKV cache; exports `normalizeTripSnapshot` |
| Create | `src/hooks/useTripConfirms.ts` | Real-time confirms listener + optimistic writes |
| Create | `src/contexts/TripContext.tsx` | Composes hooks; owns loading/error/banner render; exports `useTripContext` |
| Create | `src/features/jernie/TripLoadingScreen.tsx` | Gold arc spinner + "jernie" italic |
| Create | `src/features/jernie/TripErrorScreen.tsx` | Blocking error + retry button |
| Create | `__mocks__/@react-native-firebase/database.ts` | Jest manual mock for Firebase RTDB (JSI, can't run in Node) |
| Create | `__tests__/hooks/useTripData.test.ts` | Tests for `normalizeTripSnapshot` |
| Create | `__tests__/hooks/useTripConfirms.test.ts` | Tests for optimistic update + Firebase write |
| Create | `__tests__/components/TripLoadingScreen.test.tsx` | Snapshot test |
| Create | `__tests__/components/TripErrorScreen.test.tsx` | Snapshot test |
| Modify | `app/(trips)/[tripId]/_layout.tsx` | Wrap Stack in `TripProvider` |
| Modify | `app/(trips)/[tripId]/(tabs)/jernie.tsx` | Replace all `DEV_*` with `useTripContext()` |

---

## Task 1: Test infrastructure

**Files:**
- Create: `__mocks__/@react-native-firebase/database.ts`
- Modify: `package.json` (add devDependency)

- [ ] **Step 1: Install `@testing-library/react-native`**

```bash
npm install --save-dev @testing-library/react-native
```

Expected: installs cleanly. `package.json` gains `"@testing-library/react-native"` under `devDependencies`.

- [ ] **Step 2: Create the Firebase database manual mock**

Create `__mocks__/@react-native-firebase/database.ts`:

```typescript
// Jest manual mock for @react-native-firebase/database.
// This module is a JSI native module and cannot run in Node.js.
// Activated automatically when jest.mock('@react-native-firebase/database') is called.

const mockSet = jest.fn().mockResolvedValue(undefined);
const mockOff = jest.fn();
const mockOnce = jest.fn();
const mockOn = jest.fn();
const mockRef = jest.fn(() => ({ once: mockOnce, on: mockOn, off: mockOff, set: mockSet }));
const mockDatabase = jest.fn(() => ({ ref: mockRef }));

export { mockRef, mockOnce, mockOn, mockOff, mockSet };
export default mockDatabase;
```

- [ ] **Step 3: Verify the mock is reachable**

Run:
```bash
npx jest --listTests 2>&1 | head -5
```

Expected: lists existing test files without errors. No "Cannot find module" for Firebase.

- [ ] **Step 4: Commit**

```bash
git add __mocks__ package.json package-lock.json
git commit -m "test: add Firebase database mock and install @testing-library/react-native"
```

---

## Task 2: `normalizeTripSnapshot` — TDD

**Files:**
- Create: `src/hooks/useTripData.ts` (stub with `normalizeTripSnapshot` exported)
- Create: `__tests__/hooks/useTripData.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/hooks/useTripData.test.ts`:

```typescript
jest.mock('react-native-mmkv', () => {
  const store: Record<string, string> = {};
  return {
    createMMKV: jest.fn().mockReturnValue({
      getString: (key: string) => store[key] ?? undefined,
      set: (key: string, value: string) => { store[key] = value; },
      remove: (key: string) => { delete store[key]; },
    }),
  };
});

jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  authReady: Promise.resolve({ uid: 'test-uid' }),
  database: require('@react-native-firebase/database').default,
}));

import { normalizeTripSnapshot } from '@/src/hooks/useTripData';

const BASE = {
  id: 'trip-1',
  name: 'Test Trip',
  ownerUid: 'uid-1',
  createdAt: 1000000,
  pills: ['Adventure'],
  inviteToken: 'tok1',
  colorPack: { id: 'coastal', stopColors: ['#111'], heroGradient: ['#111', '#222'] },
  setupIntent: { flights: true, stays: true, car: false, restaurants: false },
  stops: {
    'stop-b': { id: 'stop-b', tripId: 'trip-1', city: 'Bar Harbor', region: 'ME', emoji: '⛵', lat: 44.38, lon: -68.20, dates: { start: '2026-07-12', end: '2026-07-15' }, color: '#2F6B47', order: 1 },
    'stop-a': { id: 'stop-a', tripId: 'trip-1', city: 'Portland',   region: 'ME', emoji: '🦞', lat: 43.66, lon: -70.25, dates: { start: '2026-07-10', end: '2026-07-12' }, color: '#2C5880', order: 0 },
  },
  bookings: {
    'bk-1': { id: 'bk-1', tripId: 'trip-1', stopId: 'stop-a', type: 'hotel', hotelName: 'Press Hotel', checkIn: '2026-07-10', checkOut: '2026-07-12' },
    'bk-2': { id: 'bk-2', tripId: 'trip-1', stopId: 'stop-b', type: 'hotel', hotelName: 'Bar Harbor Inn', checkIn: '2026-07-12', checkOut: '2026-07-15' },
  },
  itinerary: {
    'stop-a': {
      'day-2': { id: 'day-2', stopId: 'stop-a', dateIso: '2026-07-11', items: [] },
      'day-1': { id: 'day-1', stopId: 'stop-a', dateIso: '2026-07-10', items: [] },
    },
  },
};

describe('normalizeTripSnapshot', () => {
  test('extracts trip metadata fields', () => {
    const { trip } = normalizeTripSnapshot(BASE);
    expect(trip.id).toBe('trip-1');
    expect(trip.name).toBe('Test Trip');
    expect(trip.ownerUid).toBe('uid-1');
    expect(trip.setupIntent.flights).toBe(true);
  });

  test('sorts stops by order ascending regardless of key insertion order', () => {
    const { stops } = normalizeTripSnapshot(BASE);
    expect(stops).toHaveLength(2);
    expect(stops[0].id).toBe('stop-a');   // order: 0
    expect(stops[1].id).toBe('stop-b');   // order: 1
  });

  test('converts bookings object to flat array', () => {
    const { bookings } = normalizeTripSnapshot(BASE);
    expect(bookings).toHaveLength(2);
    expect(bookings.map(b => b.id)).toEqual(expect.arrayContaining(['bk-1', 'bk-2']));
  });

  test('sorts itinerary days by dateIso within each stop', () => {
    const { itinerary } = normalizeTripSnapshot(BASE);
    expect(itinerary['stop-a']).toHaveLength(2);
    expect(itinerary['stop-a'][0].dateIso).toBe('2026-07-10');  // day-1 sorts first
    expect(itinerary['stop-a'][1].dateIso).toBe('2026-07-11');  // day-2 sorts second
  });

  test('handles null sub-collections without throwing', () => {
    const minimal = { ...BASE, stops: null, bookings: null, itinerary: null };
    const { stops, bookings, itinerary } = normalizeTripSnapshot(minimal as never);
    expect(stops).toEqual([]);
    expect(bookings).toEqual([]);
    expect(itinerary).toEqual({});
  });

  test('handles stops with no id field by injecting the key', () => {
    const withKeylessStop = {
      ...BASE,
      stops: {
        'stop-x': { tripId: 'trip-1', city: 'X', region: 'ME', emoji: '🏝️', lat: 0, lon: 0, dates: { start: '2026-07-10', end: '2026-07-12' }, color: '#111', order: 0 },
      },
    };
    const { stops } = normalizeTripSnapshot(withKeylessStop as never);
    expect(stops[0].id).toBe('stop-x');
  });
});

// ── useTripData hook-level tests ─────────────────────────────────────────────

import { renderHook, waitFor } from '@testing-library/react-native';
import { useTripData } from '@/src/hooks/useTripData';
import database, { mockOnce } from '@react-native-firebase/database';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useTripData', () => {
  test('status starts as loading', () => {
    (mockOnce as jest.Mock).mockReturnValue(new Promise(() => {}));  // never resolves
    const { result } = renderHook(() => useTripData('trip-1'));
    expect(result.current.status).toBe('loading');
    expect(result.current.trip).toBeNull();
  });

  test('status becomes ready and trip is populated after successful fetch', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => BASE });
    const { result } = renderHook(() => useTripData('trip-1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.trip?.id).toBe('trip-1');
    expect(result.current.stops).toHaveLength(2);
    expect(result.current.fromCache).toBe(false);
  });

  test('status becomes error when fetch fails, existing state is preserved', async () => {
    (mockOnce as jest.Mock).mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useTripData('trip-1'));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.trip).toBeNull();  // no cached state, stays null
  });

  test('caches trip to MMKV on successful fetch and uses it on re-mount', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => BASE });

    // First mount — fetch succeeds, writes to MMKV
    const { result: r1, unmount } = renderHook(() => useTripData('trip-1'));
    await waitFor(() => expect(r1.current.status).toBe('ready'));
    unmount();

    // Second mount — should read from MMKV immediately (fromCache: true)
    (mockOnce as jest.Mock).mockReturnValue(new Promise(() => {}));  // stall fetch
    const { result: r2 } = renderHook(() => useTripData('trip-1'));
    expect(r2.current.trip?.id).toBe('trip-1');
    expect(r2.current.fromCache).toBe(true);
  });

  test('retry re-triggers fetch', async () => {
    (mockOnce as jest.Mock).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useTripData('trip-1'));
    await waitFor(() => expect(result.current.status).toBe('error'));

    (mockOnce as jest.Mock).mockResolvedValue({ val: () => BASE });
    result.current.retry();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.trip?.id).toBe('trip-1');
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx jest __tests__/hooks/useTripData.test.ts --no-coverage
```

Expected: FAIL — `normalizeTripSnapshot is not a function` or `Cannot find module`.

- [ ] **Step 3: Create `src/hooks/useTripData.ts` with the function**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { createMMKV } from 'react-native-mmkv';
import { database, authReady } from '@/src/lib/firebase';
import type { Trip, Stop, Booking, ItineraryDay, TripColorPackRef, SetupIntent } from '@/src/types';

const cacheStorage = createMMKV({ id: 'jernie-trip-cache' });

export interface TripDataState {
  trip: Trip | null;
  stops: Stop[];
  bookings: Booking[];
  itinerary: Record<string, ItineraryDay[]>;
  status: 'loading' | 'ready' | 'error';
  fromCache: boolean;
  retry: () => void;
}

interface CachedSnapshot {
  trip: Trip;
  stops: Stop[];
  bookings: Booking[];
  itinerary: Record<string, ItineraryDay[]>;
  cachedAt: number;
}

// Exported for unit testing. Converts a raw RTDB snapshot value into typed domain objects.
// RTDB stores collections as keyed objects; this injects keys as `id` and sorts appropriately.
export function normalizeTripSnapshot(val: Record<string, unknown>): {
  trip: Trip;
  stops: Stop[];
  bookings: Booking[];
  itinerary: Record<string, ItineraryDay[]>;
} {
  const trip: Trip = {
    id: val.id as string,
    name: val.name as string,
    ownerUid: val.ownerUid as string,
    createdAt: val.createdAt as number,
    pills: (val.pills as string[]) ?? [],
    inviteToken: val.inviteToken as string,
    colorPack: val.colorPack as TripColorPackRef,
    setupIntent: val.setupIntent as SetupIntent,
  };

  const rawStops = ((val.stops ?? {}) as Record<string, Omit<Stop, 'id'> & { id?: string }>);
  const stops: Stop[] = Object.entries(rawStops)
    .map(([key, s]) => ({ ...s, id: s.id ?? key } as Stop))
    .sort((a, b) => a.order - b.order);

  const rawBookings = ((val.bookings ?? {}) as Record<string, Omit<Booking, 'id'> & { id?: string }>);
  const bookings: Booking[] = Object.entries(rawBookings)
    .map(([key, b]) => ({ ...b, id: b.id ?? key } as Booking));

  const rawItinerary = ((val.itinerary ?? {}) as Record<string, Record<string, Omit<ItineraryDay, 'id'> & { id?: string }>>);
  const itinerary: Record<string, ItineraryDay[]> = {};
  for (const [stopId, days] of Object.entries(rawItinerary)) {
    itinerary[stopId] = Object.entries(days)
      .map(([key, d]) => ({ ...d, id: d.id ?? key } as ItineraryDay))
      .sort((a, b) => a.dateIso.localeCompare(b.dateIso));
  }

  return { trip, stops, bookings, itinerary };
}

export function useTripData(tripId: string): TripDataState {
  const cacheKey = `trip_snapshot_${tripId}`;

  const [state, setState] = useState<Omit<TripDataState, 'retry'>>(() => {
    try {
      const raw = cacheStorage.getString(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw) as CachedSnapshot;
        return { trip: cached.trip, stops: cached.stops, bookings: cached.bookings, itinerary: cached.itinerary, status: 'loading', fromCache: true };
      }
    } catch {}
    return { trip: null, stops: [], bookings: [], itinerary: {}, status: 'loading', fromCache: false };
  });

  const doFetch = useCallback(async () => {
    try {
      await authReady;
      const snap = await database().ref(`trips/${tripId}`).once('value');
      const val = snap.val() as Record<string, unknown> | null;
      if (!val) throw new Error('no data');
      const normalized = normalizeTripSnapshot(val);
      const cached: CachedSnapshot = { ...normalized, cachedAt: Date.now() };
      cacheStorage.set(cacheKey, JSON.stringify(cached));
      setState({ ...normalized, status: 'ready', fromCache: false });
    } catch {
      setState(prev => ({ ...prev, status: 'error' }));
    }
  }, [tripId, cacheKey]);

  useEffect(() => {
    doFetch();
  }, [doFetch]);

  const retry = useCallback(() => doFetch(), [doFetch]);

  return { ...state, retry };
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest __tests__/hooks/useTripData.test.ts --no-coverage
```

Expected: 11 tests PASS (6 normalizeTripSnapshot + 5 useTripData hook).

- [ ] **Step 5: Run all tests — verify no regressions**

```bash
npx jest --no-coverage
```

Expected: all 42 existing tests + 11 new = 53 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useTripData.ts __tests__/hooks/useTripData.test.ts
git commit -m "feat: add useTripData hook with normalizeTripSnapshot"
```

---

## Task 3: `useTripConfirms` hook — TDD

**Files:**
- Create: `src/hooks/useTripConfirms.ts`
- Create: `__tests__/hooks/useTripConfirms.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/hooks/useTripConfirms.test.ts`:

```typescript
jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  authReady: Promise.resolve({ uid: 'test-uid' }),
  database: require('@react-native-firebase/database').default,
}));

import { renderHook, act } from '@testing-library/react-native';
import { useTripConfirms } from '@/src/hooks/useTripConfirms';
import database, { mockOn, mockOff, mockSet, mockRef } from '@react-native-firebase/database';

// Capture the onValue callback so tests can fire it manually
let capturedOnCallback: ((snap: { val: () => unknown }) => void) | null = null;
beforeEach(() => {
  jest.clearAllMocks();
  capturedOnCallback = null;
  (mockOn as jest.Mock).mockImplementation((_event: string, cb: (snap: { val: () => unknown }) => void) => {
    capturedOnCallback = cb;
    return cb;  // @react-native-firebase returns the callback from .on()
  });
});

describe('useTripConfirms', () => {
  test('starts with empty confirms', () => {
    const { result } = renderHook(() => useTripConfirms('trip-1'));
    expect(result.current.confirms).toEqual({});
  });

  test('null guard: ignores snapshot with null value', () => {
    const { result } = renderHook(() => useTripConfirms('trip-1'));
    act(() => { capturedOnCallback?.({ val: () => null }); });
    expect(result.current.confirms).toEqual({});  // unchanged
  });

  test('updates confirms when onValue fires with data', () => {
    const { result } = renderHook(() => useTripConfirms('trip-1'));
    act(() => { capturedOnCallback?.({ val: () => ({ 'item-1': true, 'item-2': false }) }); });
    expect(result.current.confirms['item-1']).toBe(true);
    expect(result.current.confirms['item-2']).toBe(false);
  });

  test('setConfirm applies optimistic update immediately', () => {
    const { result } = renderHook(() => useTripConfirms('trip-1'));
    act(() => { result.current.setConfirm('item-3', true); });
    expect(result.current.confirms['item-3']).toBe(true);
  });

  test('setConfirm calls database().ref().set() with correct path and value', () => {
    const { result } = renderHook(() => useTripConfirms('trip-1'));
    act(() => { result.current.setConfirm('item-3', true); });
    expect(mockRef).toHaveBeenCalledWith('trips/trip-1/confirms/item-3');
    expect(mockSet).toHaveBeenCalledWith(true);
  });

  test('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useTripConfirms('trip-1'));
    unmount();
    expect(mockOff).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx jest __tests__/hooks/useTripConfirms.test.ts --no-coverage
```

Expected: FAIL — `useTripConfirms is not a function`.

- [ ] **Step 3: Implement `src/hooks/useTripConfirms.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { database } from '@/src/lib/firebase';

export interface TripConfirmsState {
  confirms: Record<string, boolean>;
  setConfirm: (itemId: string, confirmed: boolean) => void;
}

export function useTripConfirms(tripId: string): TripConfirmsState {
  const [confirms, setConfirms] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const confirmsRef = database().ref(`trips/${tripId}/confirms`);
    const listener = (snap: { val: () => Record<string, boolean> | null }) => {
      const val = snap.val();
      if (val === null) return;  // null guard: path doesn't exist yet or device is offline
      setConfirms(val);
    };
    confirmsRef.on('value', listener);
    return () => confirmsRef.off('value', listener);
  }, [tripId]);

  const setConfirm = useCallback((itemId: string, confirmed: boolean) => {
    setConfirms(prev => ({ ...prev, [itemId]: confirmed }));  // optimistic update
    database()
      .ref(`trips/${tripId}/confirms/${itemId}`)
      .set(confirmed)
      .catch(console.error);
  }, [tripId]);

  return { confirms, setConfirm };
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest __tests__/hooks/useTripConfirms.test.ts --no-coverage
```

Expected: 6 tests PASS.

- [ ] **Step 5: Run all tests**

```bash
npx jest --no-coverage
```

Expected: 53 + 6 = 59 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useTripConfirms.ts __tests__/hooks/useTripConfirms.test.ts
git commit -m "feat: add useTripConfirms hook with optimistic writes"
```

---

## Task 4: `TripLoadingScreen` + `TripErrorScreen`

**Files:**
- Create: `src/features/jernie/TripLoadingScreen.tsx`
- Create: `src/features/jernie/TripErrorScreen.tsx`
- Create: `__tests__/components/TripLoadingScreen.test.tsx`
- Create: `__tests__/components/TripErrorScreen.test.tsx`

- [ ] **Step 1: Write the snapshot tests**

Create `__tests__/components/TripLoadingScreen.test.tsx`:

```typescript
import React from 'react';
import renderer from 'react-test-renderer';
import { TripLoadingScreen } from '@/src/features/jernie/TripLoadingScreen';

test('TripLoadingScreen renders without crashing', () => {
  const tree = renderer.create(<TripLoadingScreen />).toJSON();
  expect(tree).toMatchSnapshot();
});
```

Create `__tests__/components/TripErrorScreen.test.tsx`:

```typescript
import React from 'react';
import renderer from 'react-test-renderer';
import { TripErrorScreen } from '@/src/features/jernie/TripErrorScreen';

test('TripErrorScreen renders without crashing', () => {
  const onRetry = jest.fn();
  const tree = renderer.create(<TripErrorScreen onRetry={onRetry} />).toJSON();
  expect(tree).toMatchSnapshot();
});

test('TripErrorScreen calls onRetry when button is pressed', () => {
  const onRetry = jest.fn();
  const { root } = renderer.create(<TripErrorScreen onRetry={onRetry} />);
  const button = root.findByProps({ testID: 'retry-button' });
  renderer.act(() => button.props.onPress());
  expect(onRetry).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx jest __tests__/components/ --no-coverage
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Create `src/features/jernie/TripLoadingScreen.tsx`**

```typescript
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Brand, Core, Typography } from '@/src/design/tokens';

export function TripLoadingScreen() {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 900, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  const arcStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.arc, arcStyle]} />
      <Text style={styles.label}>jernie</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Core.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arc: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2.5,
    borderColor: Brand.gold,
    borderTopColor: 'transparent',
  },
  label: {
    ...Typography.roles.h2Italic,
    color: Core.textMuted,
    marginTop: 16,
  },
});
```

- [ ] **Step 4: Create `src/features/jernie/TripErrorScreen.tsx`**

```typescript
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Brand, Core, Radius, Spacing, Typography } from '@/src/design/tokens';

interface Props {
  onRetry: () => void;
}

export function TripErrorScreen({ onRetry }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Couldn't load your trip</Text>
      <Text style={styles.body}>Check your connection and try again.</Text>
      <Pressable testID="retry-button" style={styles.button} onPress={onRetry}>
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Core.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  heading: {
    ...Typography.roles.h2,
    color: Core.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  body: {
    ...Typography.roles.body,
    color: Core.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  button: {
    backgroundColor: Brand.gold,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
  },
  buttonText: {
    ...Typography.roles.button,
    color: Core.white,
  },
});
```

- [ ] **Step 5: Run tests — expect pass**

```bash
npx jest __tests__/components/ --no-coverage
```

Expected: 3 tests PASS. Snapshots written on first run.

- [ ] **Step 6: Run all tests**

```bash
npx jest --no-coverage
```

Expected: 59 + 3 = 62 PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/jernie/TripLoadingScreen.tsx src/features/jernie/TripErrorScreen.tsx __tests__/components/
git commit -m "feat: add TripLoadingScreen and TripErrorScreen components"
```

---

## Task 5: `TripContext` + `TripProvider`

**Files:**
- Create: `src/contexts/TripContext.tsx`

- [ ] **Step 1: Create `src/contexts/TripContext.tsx`**

```typescript
import React, { createContext, useContext, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTripData } from '@/src/hooks/useTripData';
import { useTripConfirms } from '@/src/hooks/useTripConfirms';
import { TripLoadingScreen } from '@/src/features/jernie/TripLoadingScreen';
import { TripErrorScreen } from '@/src/features/jernie/TripErrorScreen';
import { Semantic, Spacing, Typography } from '@/src/design/tokens';
import type { Trip, Stop, Booking, ItineraryDay } from '@/src/types';

export interface TripContextValue {
  trip: Trip;
  stops: Stop[];
  bookings: Booking[];
  itinerary: Record<string, ItineraryDay[]>;
  confirms: Record<string, boolean>;
  setConfirm: (itemId: string, confirmed: boolean) => void;
  fromCache: boolean;
}

const TripContext = createContext<TripContextValue | null>(null);

export function useTripContext(): TripContextValue {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTripContext must be used inside TripProvider');
  return ctx;
}

interface TripProviderProps {
  tripId: string;
  children: ReactNode;
}

function OfflineBanner({ onRetry }: { onRetry: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      style={[styles.banner, { paddingTop: insets.top + Spacing.sm }]}
      onPress={onRetry}
    >
      <Text style={styles.bannerText}>Showing saved trip · Tap to retry</Text>
    </Pressable>
  );
}

export function TripProvider({ tripId, children }: TripProviderProps) {
  const tripData = useTripData(tripId);
  const confirmsState = useTripConfirms(tripId);

  if (tripData.status === 'loading' && tripData.trip === null) {
    return <TripLoadingScreen />;
  }

  if (tripData.status === 'error' && tripData.trip === null) {
    return <TripErrorScreen onRetry={tripData.retry} />;
  }

  const value: TripContextValue = {
    trip: tripData.trip!,
    stops: tripData.stops,
    bookings: tripData.bookings,
    itinerary: tripData.itinerary,
    confirms: confirmsState.confirms,
    setConfirm: confirmsState.setConfirm,
    fromCache: tripData.fromCache,
  };

  return (
    <TripContext.Provider value={value}>
      <View style={styles.container}>
        {children}
        {tripData.fromCache && <OfflineBanner onRetry={tripData.retry} />}
      </View>
    </TripContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Semantic.warningTint,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.base,
    alignItems: 'center',
  },
  bannerText: {
    ...Typography.roles.meta,
    color: Semantic.warning,
  },
});
```

- [ ] **Step 2: Run all tests**

```bash
npx jest --no-coverage
```

Expected: 62 PASS. No regressions.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/contexts/TripContext.tsx
git commit -m "feat: add TripContext, TripProvider, and OfflineBanner"
```

---

## Task 6: Trip shell wiring

**Files:**
- Modify: `app/(trips)/[tripId]/_layout.tsx`

- [ ] **Step 1: Update `app/(trips)/[tripId]/_layout.tsx`**

Replace the entire file:

```typescript
import { Stack, useLocalSearchParams } from 'expo-router';
import { NavigationProvider } from '@/src/contexts/NavigationContext';
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

- [ ] **Step 2: Run all tests**

```bash
npx jest --no-coverage
```

Expected: 62 PASS.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(trips)/[tripId]/_layout.tsx"
git commit -m "feat: wire TripProvider into trip shell layout"
```

---

## Task 7: `jernie.tsx` fixture swap

**Files:**
- Modify: `app/(trips)/[tripId]/(tabs)/jernie.tsx`

This task replaces all `DEV_*` fixture imports with `useTripContext()`. The current file (Sprint 1) uses a plain `ScrollView`. The animation changes (Animated.ScrollView, `scrollY`, `visibleStop`) from Sprint 2a will be applied in a separate sprint — this task only touches the data source.

- [ ] **Step 1: Replace `app/(trips)/[tripId]/(tabs)/jernie.tsx`**

```typescript
import React, { useState, useRef, useMemo, useCallback } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { createMMKV } from 'react-native-mmkv';
import { useTripContext } from '@/src/contexts/TripContext';
import { getActiveStopId, getAutoExpandDayIndex } from '@/src/domain/trip';
import { getDevNow } from '@/src/utils/devTime';
import { HeroLayer } from '@/src/features/jernie/HeroLayer';
import { CTACardZone } from '@/src/features/jernie/CTACardZone';
import { StopsStrip } from '@/src/features/jernie/StopsStrip';
import { StopSection } from '@/src/features/jernie/StopSection';
import { Core } from '@/src/design/tokens';
import type { Booking } from '@/src/types';

const uiStorage = createMMKV({ id: 'jernie-ui' });

export default function JernieTab() {
  const { trip, stops, bookings, itinerary } = useTripContext();

  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<string, number>>({});

  const now = getDevNow();
  const activeStopId = getActiveStopId(stops, now);
  const activeStop = stops.find(s => s.id === activeStopId) ?? stops[0];

  const ctaKey = `cta_dismissed_${trip.id}`;
  const [ctaDismissed, setCtaDismissed] = useState(
    () => uiStorage.getBoolean(ctaKey) ?? false,
  );

  const [expandedDayIds, setExpandedDayIds] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(stops.map(s => {
      const days = itinerary[s.id] ?? [];
      const idx = getAutoExpandDayIndex(days, now);
      return [s.id, idx >= 0 ? (days[idx]?.id ?? null) : null];
    }))
  );

  function setExpandedDayId(stopId: string, dayId: string | null) {
    setExpandedDayIds(prev => ({ ...prev, [stopId]: dayId }));
  }

  const bookingsByStop = useMemo(
    () => Object.fromEntries(
      stops.map(s => [s.id, bookings.filter((b: Booking) => b.stopId === s.id)])
    ),
    [stops, bookings],
  );

  const handleDismissCTA = useCallback(() => {
    uiStorage.set(ctaKey, true);
    setCtaDismissed(true);
  }, [ctaKey]);

  const handleDayPress = useCallback(
    (stopId: string, dayId: string | null) => setExpandedDayId(stopId, dayId),
    [],
  );

  const handleSectionLayout = useCallback(
    (stopId: string, y: number) => { sectionOffsets.current[stopId] = y; },
    [],
  );

  function handleStopPress(stopId: string) {
    const offset = sectionOffsets.current[stopId];
    if (offset !== undefined) {
      scrollRef.current?.scrollTo({ y: offset, animated: true });
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        stickyHeaderIndices={[1, 2]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustKeyboardInsets={false}
      >
        {/* 0 — scrolls away */}
        <HeroLayer trip={trip} activeStop={activeStop} />

        {/* 1 — always-rendered wrapper keeps stickyHeaderIndices[1] stable when CTA dismissed */}
        <View>
          {!ctaDismissed && (
            <CTACardZone
              trip={trip}
              stops={stops}
              onDismiss={handleDismissCTA}
            />
          )}
        </View>

        {/* 2 — stacks below CTA when both are sticky */}
        <StopsStrip
          stops={stops}
          activeStopId={activeStopId}
          onStopPress={handleStopPress}
        />

        {/* 3+ */}
        {stops.map(stop => (
          <StopSection
            key={stop.id}
            stop={stop}
            bookings={bookingsByStop[stop.id] ?? []}
            days={itinerary[stop.id] ?? []}
            expandedDayId={expandedDayIds[stop.id] ?? null}
            onDayPress={dayId => handleDayPress(stop.id, dayId)}
            onSectionLayout={y => handleSectionLayout(stop.id, y)}
          />
        ))}

        <View style={styles.bottomPad} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Core.bg },
  bottomPad: { height: 48 },
});
```

- [ ] **Step 2: Run all tests**

```bash
npx jest --no-coverage
```

Expected: 62 PASS. The fixture swap doesn't affect any existing test suites since none render `jernie.tsx`.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(trips)/[tripId]/(tabs)/jernie.tsx"
git commit -m "feat: replace fixture imports with useTripContext in jernie.tsx"
```

---

## Task 8: Final verification

- [ ] **Step 1: Run full test suite with coverage summary**

```bash
npx jest --no-coverage
```

Expected output (exact counts may vary by a test or two):
```
Test Suites: 9 passed, 9 total
Tests:       62 passed, 62 total
```

- [ ] **Step 2: TypeScript strict check**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 3: Confirm all new files are committed**

```bash
git status
```

Expected: `nothing to commit, working tree clean`.

- [ ] **Step 4: Tag sprint completion**

```bash
git tag v0.3.0-sprint2b
```
