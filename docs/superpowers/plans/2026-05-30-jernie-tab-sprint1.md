# Jernie Tab Sprint 1: Static Scaffold — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Jernie tab with all 4 layers (Hero, CTA setup card, Stops strip, Itinerary accordion) wired to static fixture data with functional stop-tap scrolling and accordion expand/collapse — no Reanimated.

**Architecture:** A single `ScrollView` in `jernie.tsx` owns all state. `stickyHeaderIndices={[1, 2]}` gives native UIScrollView sticky behavior for the CTA zone (index 1, always-rendered wrapper) and Stops strip (index 2). Accordion state is a `Record<stopId, dayId|null>` map. Section scroll offsets are captured via `onLayout` callbacks and stored in a `useRef` map. Components are leaf nodes that communicate only through props.

**Tech Stack:** React Native 0.85, Expo SDK 56, expo-linear-gradient, react-native-safe-area-context, TypeScript 6

---

## File Map

| File | Action |
|---|---|
| `src/types.ts` | Modify — add `time?: string` to `ItineraryItem` |
| `src/design/tokens.ts` | Modify — add `h2Bold` to `Typography.roles` |
| `src/domain/trip.ts` | Modify — add `getActiveStopId` function |
| `__tests__/domain-trip.test.ts` | Modify — add `getActiveStopId` tests |
| `src/fixtures/devTrip.ts` | Create — Maine Summer 2026 fixture trip |
| `src/features/jernie/components/TravelCard.tsx` | Create — flight/hotel/rental card |
| `src/features/jernie/components/ItineraryDayRow.tsx` | Create — accordion day row |
| `src/features/jernie/HeroLayer.tsx` | Create — gradient hero |
| `src/features/jernie/CTACardZone.tsx` | Create — setup progress card |
| `src/features/jernie/StopsStrip.tsx` | Create — horizontal pill strip |
| `src/features/jernie/StopSection.tsx` | Create — one stop: cards + accordion |
| `app/(trips)/[tripId]/(tabs)/jernie.tsx` | Modify — screen orchestrator |

---

## Task 0: Install expo-linear-gradient

**Files:**
- Modify: `package.json` (via npx expo install)

- [ ] **Step 1: Install the package**

```bash
cd /home/jstraw4663/jernie-native && npx expo install expo-linear-gradient
```

Expected output: `+ expo-linear-gradient@X.Y.Z` added to package.json. No rebuild is needed for the dev client — expo-linear-gradient's native module is bundled in Expo SDK 56's dev client binary.

> **If you see a "native module not found" error at runtime** after completing all tasks, a new EAS build is required: `eas build --profile development --platform ios`. This is unlikely with Expo SDK 56 but possible on first install.

- [ ] **Step 2: Verify install**

```bash
ls /home/jstraw4663/jernie-native/node_modules/expo-linear-gradient/src/index.tsx && echo "ok"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json 2>/dev/null; git add yarn.lock 2>/dev/null; git add package.json
git commit -m "feat: add expo-linear-gradient for hero gradient"
```

---

## Task 1: Extend types, tokens, and domain logic

**Files:**
- Modify: `src/types.ts:133-143`
- Modify: `src/design/tokens.ts:99-114`
- Modify: `src/domain/trip.ts` (append)
- Modify: `__tests__/domain-trip.test.ts` (append)

- [ ] **Step 1: Add `time?` to ItineraryItem in src/types.ts**

Find the `ItineraryItem` interface (currently lines 133–143) and add `time?: string` after `label?`:

```typescript
export interface ItineraryItem {
  id: string;
  type: 'place' | 'booking' | 'custom';
  placeId?: string;
  bookingId?: string;
  label?: string;
  time?: string;
  category?: ItineraryItemCategory;
  order: number;
  locked?: boolean;
}
```

- [ ] **Step 2: Add h2Bold to Typography.roles in src/design/tokens.ts**

Find the `roles` object inside `Typography` (around line 103). Add `h2Bold` after the `h2Italic` entry:

```typescript
h2Bold:    { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, fontFamily: 'Fraunces' },
```

The `Typography.roles` block will look like:
```typescript
export const Typography = {
  family: { ... },
  roles: {
    display:   { fontSize: 36, lineHeight: 40, fontWeight: '400' as const, fontFamily: 'Fraunces', letterSpacing: -0.54 },
    h1:        { fontSize: 28, lineHeight: 34, fontWeight: '400' as const, fontFamily: 'Fraunces' },
    h1Bold:    { fontSize: 28, lineHeight: 34, fontWeight: '700' as const, fontFamily: 'Fraunces' },
    h2:        { fontSize: 22, lineHeight: 28, fontWeight: '400' as const, fontFamily: 'Fraunces' },
    h2Italic:  { fontSize: 22, lineHeight: 28, fontWeight: '400' as const, fontFamily: 'Fraunces', fontStyle: 'italic' as const },
    h2Bold:    { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, fontFamily: 'Fraunces' },
    h3:        { fontSize: 18, lineHeight: 24, fontWeight: '600' as const, fontFamily: 'DMSans' },
    // ... rest unchanged
  },
```

- [ ] **Step 3: Write failing test for getActiveStopId**

**3a.** First update the two existing imports at the top of `__tests__/domain-trip.test.ts` (lines 6–13):

```typescript
// Replace the existing two import lines with these expanded versions:
import {
  parseFlightDate,
  formatCountdown,
  getAutoExpandDayIndex,
  getFlightPhase,
  getRentalPhase,
  getActiveStopId,           // ← add this
} from '@/src/domain/trip';
import type { ItineraryDay, Stop } from '@/src/types';  // ← add Stop
```

**3b.** Then append the test cases to the **end** of the file (no new import statements):

```typescript
// getActiveStopId
const TEST_STOPS: Stop[] = [
  {
    id: 'stop-a', tripId: 't1', city: 'Portland', region: 'ME', emoji: '🦞',
    lat: 43.6615, lon: -70.2553,
    dates: { start: '2026-07-10', end: '2026-07-12' },
    color: '#2C5880', order: 0,
  },
  {
    id: 'stop-b', tripId: 't1', city: 'Bar Harbor', region: 'ME', emoji: '⛵',
    lat: 44.3876, lon: -68.2039,
    dates: { start: '2026-07-12', end: '2026-07-15' },
    color: '#2F6B47', order: 1,
  },
];

test('getActiveStopId: returns first stop when pre-trip', () => {
  expect(getActiveStopId(TEST_STOPS, new Date('2026-06-01T12:00:00'))).toBe('stop-a');
});

test('getActiveStopId: returns matching stop during trip (first stop)', () => {
  expect(getActiveStopId(TEST_STOPS, new Date('2026-07-10T12:00:00'))).toBe('stop-a');
});

test('getActiveStopId: returns matching stop during trip (second stop)', () => {
  expect(getActiveStopId(TEST_STOPS, new Date('2026-07-12T12:00:00'))).toBe('stop-b');
});

test('getActiveStopId: returns last stop post-trip', () => {
  expect(getActiveStopId(TEST_STOPS, new Date('2026-07-20T12:00:00'))).toBe('stop-b');
});

test('getActiveStopId: returns null for empty stops array', () => {
  expect(getActiveStopId([], new Date())).toBeNull();
});
```

- [ ] **Step 4: Run test to confirm it fails**

```bash
cd /home/jstraw4663/jernie-native && npx jest __tests__/domain-trip.test.ts --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `getActiveStopId is not a function` or similar.

- [ ] **Step 5: Add getActiveStopId to src/domain/trip.ts**

First, update the import at the top of `src/domain/trip.ts` to include `Stop`:

```typescript
import type { ItineraryDay, Stop } from '@/src/types';
```

Then append to the end of the file:

```typescript
// ── Active stop detection ─────────────────────────────────────────────────────

/**
 * Returns the id of the active stop based on today's date.
 * Pre-trip → first stop. During trip → matching stop. Post-trip → last stop.
 */
export function getActiveStopId(stops: Stop[], now: Date): string | null {
  if (stops.length === 0) return null;
  const todayIso = now.toISOString().split('T')[0];
  const current = stops.find(s => todayIso >= s.dates.start && todayIso < s.dates.end);
  if (current) return current.id;
  if (todayIso < stops[0].dates.start) return stops[0].id;
  return stops[stops.length - 1].id;
}
```

- [ ] **Step 6: Run tests — expect all to pass**

```bash
cd /home/jstraw4663/jernie-native && npx jest __tests__/domain-trip.test.ts --no-coverage 2>&1 | tail -20
```

Expected: PASS — all tests green including the 5 new `getActiveStopId` tests.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/design/tokens.ts src/domain/trip.ts __tests__/domain-trip.test.ts
git commit -m "feat: extend ItineraryItem with time, add h2Bold, add getActiveStopId"
```

---

## Task 2: Create fixture data

**Files:**
- Create: `src/fixtures/devTrip.ts`

- [ ] **Step 1: Create the fixture file**

Create `src/fixtures/devTrip.ts` with the complete Maine Summer 2026 fixture. This file exports `DEV_TRIP`, `DEV_STOPS`, `DEV_BOOKINGS`, and `DEV_ITINERARY` typed against the production types — swap for RTDB hooks in Sprint 2 with no component changes.

```typescript
import type { Trip, Stop, Booking, ItineraryDay } from '@/src/types';

export const DEV_TRIP: Trip = {
  id: 'dev-trip-001',
  name: 'Maine Summer 2026',
  ownerUid: 'dev-uid',
  createdAt: Date.now(),
  pills: ['Adventure', 'Food-forward'],
  inviteToken: 'abc123',
  colorPack: {
    id: 'coastal',
    stopColors: ['#2C5880', '#2F6B47'],
    heroGradient: ['#0D2B3E', '#2C5880'],
  },
  setupIntent: { flights: true, stays: true, car: false, restaurants: false },
};

export const DEV_STOPS: Stop[] = [
  {
    id: 'stop-portland',
    tripId: 'dev-trip-001',
    city: 'Portland',
    region: 'ME',
    emoji: '🦞',
    lat: 43.6615,
    lon: -70.2553,
    dates: { start: '2026-07-10', end: '2026-07-12' },
    color: '#2C5880',
    order: 0,
  },
  {
    id: 'stop-bar-harbor',
    tripId: 'dev-trip-001',
    city: 'Bar Harbor',
    region: 'ME',
    emoji: '⛵',
    lat: 44.3876,
    lon: -68.2039,
    dates: { start: '2026-07-12', end: '2026-07-15' },
    color: '#2F6B47',
    order: 1,
  },
];

export const DEV_BOOKINGS: Booking[] = [
  {
    id: 'booking-flight-1',
    tripId: 'dev-trip-001',
    stopId: 'stop-portland',
    type: 'flight',
    airline: 'JetBlue',
    flightNumber: 'B6 274',
    origin: 'BOS',
    destination: 'PWM',
    departureDate: '2026-07-10',
    departureTime: '7:15 AM',
    arrivalTime: '8:22 AM',
    confirmationCode: 'JBLMNE',
  },
  {
    id: 'booking-hotel-portland',
    tripId: 'dev-trip-001',
    stopId: 'stop-portland',
    type: 'hotel',
    hotelName: 'Press Hotel',
    checkIn: '2026-07-10',
    checkOut: '2026-07-12',
    confirmationCode: 'PHR2026',
  },
  {
    id: 'booking-rental-1',
    tripId: 'dev-trip-001',
    stopId: 'stop-portland',
    type: 'rental',
    company: 'Enterprise',
    carType: 'Compact SUV',
    pickupDate: '2026-07-10',
    pickupTime: '9:00 AM',
    dropoffDate: '2026-07-15',
    pickupLocation: 'Portland Jetport',
    dropoffLocation: 'Trenton, ME',
  },
  {
    id: 'booking-hotel-bar-harbor',
    tripId: 'dev-trip-001',
    stopId: 'stop-bar-harbor',
    type: 'hotel',
    hotelName: 'Bar Harbor Inn',
    checkIn: '2026-07-12',
    checkOut: '2026-07-15',
  },
];

export const DEV_ITINERARY: Record<string, ItineraryDay[]> = {
  'stop-portland': [
    {
      id: 'day-pdx-1',
      stopId: 'stop-portland',
      dateIso: '2026-07-10',
      items: [
        { id: 'i-pdx-1-1', type: 'custom', label: 'Arrive PWM · Pick up rental car', time: '8:22 AM', category: 'transport', order: 0 },
        { id: 'i-pdx-1-2', type: 'custom', label: 'Duckfat lunch',                   time: '12:00 PM', category: 'restaurant', order: 1 },
        { id: 'i-pdx-1-3', type: 'custom', label: 'Portland Head Light',             time: '3:00 PM',  category: 'sight',      order: 2 },
      ],
    },
    {
      id: 'day-pdx-2',
      stopId: 'stop-portland',
      dateIso: '2026-07-11',
      items: [
        { id: 'i-pdx-2-1', type: 'custom', label: 'Maine Narrow Gauge Railroad', time: '10:00 AM', category: 'activity',   order: 0 },
        { id: 'i-pdx-2-2', type: 'custom', label: 'Eventide Oyster Co.',         time: '6:00 PM',  category: 'restaurant', order: 1 },
      ],
    },
  ],
  'stop-bar-harbor': [
    {
      id: 'day-bh-1',
      stopId: 'stop-bar-harbor',
      dateIso: '2026-07-12',
      items: [
        { id: 'i-bh-1-1', type: 'custom', label: 'Drive to Bar Harbor (2.5 hrs)', time: '9:00 AM',  category: 'transport',  order: 0 },
        { id: 'i-bh-1-2', type: 'custom', label: 'Check in · Bar Harbor Inn',     time: '3:00 PM',  category: 'custom',     order: 1 },
        { id: 'i-bh-1-3', type: 'custom', label: "Geddy's pub dinner",            time: '7:00 PM',  category: 'restaurant', order: 2 },
      ],
    },
    {
      id: 'day-bh-2',
      stopId: 'stop-bar-harbor',
      dateIso: '2026-07-13',
      items: [
        { id: 'i-bh-2-1', type: 'custom', label: 'Acadia National Park hike',   time: '8:00 AM',   category: 'hike',       order: 0 },
        { id: 'i-bh-2-2', type: 'custom', label: 'Jordan Pond House lunch',     time: '12:30 PM',  category: 'restaurant', order: 1 },
        { id: 'i-bh-2-3', type: 'custom', label: 'Cadillac Mountain sunset',    time: '7:30 PM',   category: 'sight',      order: 2 },
      ],
    },
    {
      id: 'day-bh-3',
      stopId: 'stop-bar-harbor',
      dateIso: '2026-07-14',
      items: [
        { id: 'i-bh-3-1', type: 'custom', label: 'Trailhead Cafe breakfast', time: '8:00 AM',  category: 'restaurant', order: 0 },
        { id: 'i-bh-3-2', type: 'custom', label: 'Morning kayak tour',       time: '10:00 AM', category: 'activity',   order: 1 },
      ],
    },
  ],
};
```

> **setupIntent note:** `car: false, restaurants: false` gives 50% progress (2/4). This matches the spec's visual showing 2 open action rows. Adjust to `car: true` for 75% if preferred.

- [ ] **Step 2: Verify TypeScript accepts the file**

```bash
cd /home/jstraw4663/jernie-native && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `src/fixtures/devTrip.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/fixtures/devTrip.ts
git commit -m "feat: add Maine Summer 2026 fixture data"
```

---

## Task 3: TravelCard component

**Files:**
- Create: `src/features/jernie/components/TravelCard.tsx`

- [ ] **Step 1: Create TravelCard.tsx**

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Booking, BookingType } from '@/src/types';
import { Core, TypeColors, Typography, Radius, Shadow, Spacing } from '@/src/design/tokens';

const BOOKING_TYPE_COLOR: Record<BookingType, string> = {
  flight:     TypeColors.flight,
  hotel:      TypeColors.stay,
  rental:     TypeColors.car,
  restaurant: TypeColors.food,
};

interface TravelCardProps {
  booking: Booking;
}

export function TravelCard({ booking }: TravelCardProps) {
  const accentColor = BOOKING_TYPE_COLOR[booking.type];
  return (
    <View style={[styles.card, Shadow.cardResting]}>
      <View style={[styles.accent, { backgroundColor: accentColor }]} />
      <View style={styles.content}>
        {booking.type === 'flight'  && <FlightContent  booking={booking} />}
        {booking.type === 'hotel'   && <HotelContent   booking={booking} />}
        {booking.type === 'rental'  && <RentalContent  booking={booking} />}
      </View>
    </View>
  );
}

function FlightContent({ booking }: { booking: Extract<Booking, { type: 'flight' }> }) {
  return (
    <>
      <Text style={styles.label}>{booking.airline} · {booking.flightNumber}</Text>
      <Text style={styles.h3}>{booking.origin} → {booking.destination}</Text>
      <View style={styles.row}>
        <Text style={styles.mono}>{booking.departureTime}</Text>
        <Text style={styles.monoFaint}> – </Text>
        <Text style={styles.mono}>{booking.arrivalTime}</Text>
      </View>
      <View style={[styles.statusPill, { backgroundColor: '#D1F0DF' }]}>
        <Text style={[styles.statusText, { color: '#3E7B52' }]}>On time</Text>
      </View>
    </>
  );
}

function HotelContent({ booking }: { booking: Extract<Booking, { type: 'hotel' }> }) {
  const nights = daysBetween(booking.checkIn, booking.checkOut);
  return (
    <>
      <Text style={styles.h3}>{booking.hotelName}</Text>
      <Text style={styles.meta}>{shortDate(booking.checkIn)} – {shortDate(booking.checkOut)}</Text>
      <Text style={styles.mono}>{nights} night{nights !== 1 ? 's' : ''}</Text>
    </>
  );
}

function RentalContent({ booking }: { booking: Extract<Booking, { type: 'rental' }> }) {
  return (
    <>
      <Text style={styles.h3}>{booking.pickupLocation}</Text>
      <Text style={styles.meta}>{shortDate(booking.pickupDate)} – {shortDate(booking.dropoffDate)}</Text>
      <Text style={styles.meta}>
        {booking.company}{booking.carType ? ` · ${booking.carType}` : ''}
      </Text>
    </>
  );
}

function daysBetween(start: string, end: string): number {
  const a = new Date(start + 'T12:00:00');
  const b = new Date(end + 'T12:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function shortDate(iso: string): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date(iso + 'T12:00:00');
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: Radius.list,
    backgroundColor: Core.surface,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  accent: { width: 3 },
  content: { flex: 1, padding: Spacing.md },
  label:      { ...Typography.roles.label,     color: Core.textMuted, marginBottom: 2 },
  h3:         { ...Typography.roles.h3,        color: Core.text,      marginBottom: 4 },
  meta:       { ...Typography.roles.meta,      color: Core.textMuted, marginBottom: 2 },
  row:        { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  mono:       { ...Typography.roles.mono,      color: Core.text },
  monoFaint:  { ...Typography.roles.mono,      color: Core.textMuted },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    marginTop: 4,
  },
  statusText: { ...Typography.roles.labelCaps },
});
```

- [ ] **Step 2: TypeScript check**

```bash
cd /home/jstraw4663/jernie-native && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors from `TravelCard.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/features/jernie/components/TravelCard.tsx
git commit -m "feat: add TravelCard component (flight/hotel/rental)"
```

---

## Task 4: ItineraryDayRow component

**Files:**
- Create: `src/features/jernie/components/ItineraryDayRow.tsx`

- [ ] **Step 1: Create ItineraryDayRow.tsx**

```typescript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { ItineraryDay, ItineraryItemCategory } from '@/src/types';
import { Core, TypeColors, Typography, Radius, Spacing } from '@/src/design/tokens';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const CATEGORY_COLOR: Partial<Record<ItineraryItemCategory, string>> = {
  flight:     TypeColors.flight,
  restaurant: TypeColors.food,
  activity:   TypeColors.activity,
  sight:      TypeColors.sight,
  hike:       TypeColors.hike,
  transport:  TypeColors.car,
};

interface ItineraryDayRowProps {
  day: ItineraryDay;
  dayNumber: number;
  stopColor: string;
  isExpanded: boolean;
  onPress: () => void;
}

export function ItineraryDayRow({ day, dayNumber, stopColor, isExpanded, onPress }: ItineraryDayRowProps) {
  const d = new Date(day.dateIso + 'T12:00:00');
  const dateLabel = `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
  const sortedItems = [...day.items].sort((a, b) => a.order - b.order);

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity onPress={onPress} style={styles.header} activeOpacity={0.7}>
        <View style={styles.headerLeft}>
          <View style={[styles.dotHalo, { backgroundColor: hexWithAlpha(stopColor, 0.18) }]}>
            <View style={[styles.dot, { backgroundColor: stopColor }]} />
          </View>
          <View>
            <Text style={styles.dayLabel}>Day {dayNumber}</Text>
            <Text style={styles.dateLabel}>{dateLabel}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.itemCount}>{day.items.length} item{day.items.length !== 1 ? 's' : ''}</Text>
          <Text style={[styles.chevron, isExpanded && styles.chevronOpen]}>›</Text>
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.itemList}>
          {sortedItems.map(item => {
            const cat = item.category;
            const color = (cat ? CATEGORY_COLOR[cat] : undefined) ?? Core.textMuted;
            return (
              <View key={item.id} style={styles.itemRow}>
                <Text style={[styles.itemTime, { color: stopColor }]}>{item.time ?? ''}</Text>
                <Text style={styles.itemName} numberOfLines={2}>{item.label ?? ''}</Text>
                {cat && (
                  <View style={[styles.catPill, { backgroundColor: hexWithAlpha(color, 0.12) }]}>
                    <Text style={[styles.catText, { color }]}>{cat}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function hexWithAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Core.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dotHalo: {
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dayLabel:  { ...Typography.roles.label, color: Core.text },
  dateLabel: { ...Typography.roles.meta,  color: Core.textMuted },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemCount:  { ...Typography.roles.meta, color: Core.textMuted },
  chevron:    { fontSize: 20, color: Core.textMuted, transform: [{ rotate: '0deg' }] },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  itemList: { paddingBottom: Spacing.sm },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: Spacing.base,
    gap: 8,
  },
  itemTime: { ...Typography.roles.mono, width: 52 },
  itemName: { ...Typography.roles.body, color: Core.text, flex: 1 },
  catPill:  { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full },
  catText:  { ...Typography.roles.labelCaps },
});
```

- [ ] **Step 2: TypeScript check**

```bash
cd /home/jstraw4663/jernie-native && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors from `ItineraryDayRow.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/features/jernie/components/ItineraryDayRow.tsx
git commit -m "feat: add ItineraryDayRow accordion component"
```

---

## Task 5: HeroLayer component

**Files:**
- Create: `src/features/jernie/HeroLayer.tsx`

- [ ] **Step 1: Create HeroLayer.tsx**

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Trip, Stop } from '@/src/types';
import { Typography, Radius, Spacing, Semantic } from '@/src/design/tokens';

interface HeroLayerProps {
  trip: Trip;
  activeStop: Stop;
}

function formatDateRange(start: string, end: string): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  return `${months[s.getMonth()]} ${s.getDate()}–${e.getDate()}`;
}

export function HeroLayer({ trip, activeStop }: HeroLayerProps) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={trip.colorPack.heroGradient}
      style={[styles.hero, { paddingTop: insets.top + Spacing.base }]}
    >
      <View style={styles.pillRow}>
        <View style={styles.tripPill}>
          <Text style={styles.tripPillText}>{trip.name}</Text>
        </View>
        <View style={styles.phasePill}>
          <Text style={styles.phaseText}>Pre-trip</Text>
        </View>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.city}>{activeStop.city}</Text>
        <Text style={styles.subtitle}>
          {formatDateRange(activeStop.dates.start, activeStop.dates.end)} · {activeStop.city}, {activeStop.region}
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: 280,
    borderBottomLeftRadius: Radius.hero,
    borderBottomRightRadius: Radius.hero,
    marginBottom: -4,
    paddingHorizontal: Spacing.base,
    justifyContent: 'space-between',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tripPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tripPillText: {
    ...Typography.roles.label,
    color: 'rgba(255,255,255,0.9)',
  },
  phasePill: {
    backgroundColor: Semantic.warningTint,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  phaseText: {
    ...Typography.roles.label,
    color: Semantic.warning,
  },
  bottom: {
    paddingBottom: Spacing.xl,
  },
  city: {
    ...Typography.roles.display,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    ...Typography.roles.meta,
    color: 'rgba(255,255,255,0.7)',
  },
});
```

- [ ] **Step 2: TypeScript check**

```bash
cd /home/jstraw4663/jernie-native && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors from `HeroLayer.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/features/jernie/HeroLayer.tsx
git commit -m "feat: add HeroLayer with LinearGradient and phase pills"
```

---

## Task 6: CTACardZone component

**Files:**
- Create: `src/features/jernie/CTACardZone.tsx`

- [ ] **Step 1: Create CTACardZone.tsx**

```typescript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Trip, Stop, Booking } from '@/src/types';
import { Core, Typography, Radius, Shadow, Spacing } from '@/src/design/tokens';

type SetupKey = keyof Trip['setupIntent'];

const SETUP_ROWS: Array<{ key: SetupKey; emoji: string; label: string; cta: string }> = [
  { key: 'flights',     emoji: '✈️', label: 'Flights',      cta: 'Book →' },
  { key: 'stays',       emoji: '🏨', label: 'Stays',        cta: 'Book →' },
  { key: 'car',         emoji: '🚗', label: 'Rental car',   cta: 'Add →'  },
  { key: 'restaurants', emoji: '🍽️', label: 'Restaurants',  cta: 'Add →'  },
];

interface CTACardZoneProps {
  trip: Trip;
  stops: Stop[];
  bookings: Booking[];
  onDismiss: () => void;
}

export function CTACardZone({ trip, stops, onDismiss }: CTACardZoneProps) {
  const stopColor = stops[0]?.color ?? '#2C5880';
  const doneCount = SETUP_ROWS.filter(r => trip.setupIntent[r.key]).length;
  const progressPct = Math.round((doneCount / SETUP_ROWS.length) * 100);

  return (
    <View style={[styles.card, Shadow.cardResting]}>
      <View style={styles.headerRow}>
        <Text style={styles.tripName} numberOfLines={1}>{trip.name}</Text>
        <Text style={[styles.progressLabel, { color: stopColor }]}>{progressPct}%</Text>
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.dismiss}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPct}%` as `${number}%`, backgroundColor: stopColor }]} />
      </View>

      {SETUP_ROWS.map(row => {
        const done = trip.setupIntent[row.key];
        return (
          <View key={row.key} style={styles.checkRow}>
            <Text style={styles.checkMark}>{done ? '✓' : '○'}</Text>
            <Text style={styles.checkEmoji}>{row.emoji}</Text>
            <Text style={[styles.checkLabel, done && styles.checkLabelDone]}>{row.label}</Text>
            {!done && <Text style={[styles.ctaText, { color: stopColor }]}>{row.cta}</Text>}
          </View>
        );
      })}

      <View style={styles.emailStrip}>
        <Text style={styles.emailText}>📧 Forward confirmations to add@jernie.app</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    backgroundColor: Core.surface,
    marginHorizontal: Spacing.md,
    paddingTop: Spacing.base,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    gap: 8,
  },
  tripName:      { ...Typography.roles.h3,        color: Core.text,      flex: 1 },
  progressLabel: { ...Typography.roles.labelCaps },
  dismiss:       { ...Typography.roles.body,       color: Core.textFaint },
  progressTrack: {
    height: 3,
    backgroundColor: Core.surfaceMuted,
    marginHorizontal: Spacing.base,
    borderRadius: Radius.full,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    borderRadius: Radius.full,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: 6,
    gap: 6,
  },
  checkMark:     { ...Typography.roles.label, color: Core.textMuted, width: 16 },
  checkEmoji:    { fontSize: 15 },
  checkLabel:    { ...Typography.roles.body,  color: Core.text,      flex: 1 },
  checkLabelDone:{ color: Core.textMuted },
  ctaText:       { ...Typography.roles.label },
  emailStrip: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Core.border,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  emailText: { ...Typography.roles.meta, color: Core.textFaint },
});
```

- [ ] **Step 2: TypeScript check**

```bash
cd /home/jstraw4663/jernie-native && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors from `CTACardZone.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/features/jernie/CTACardZone.tsx
git commit -m "feat: add CTACardZone setup progress card"
```

---

## Task 7: StopsStrip component

**Files:**
- Create: `src/features/jernie/StopsStrip.tsx`

- [ ] **Step 1: Create StopsStrip.tsx**

```typescript
import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Stop } from '@/src/types';
import { Core, Semantic, Typography, Radius, Spacing } from '@/src/design/tokens';

interface StopsStripProps {
  stops: Stop[];
  activeStopId: string | null;
  onStopPress: (stopId: string) => void;
}

type StopState = 'active' | 'past' | 'future';

function getStopState(stop: Stop, activeStopId: string | null, stops: Stop[]): StopState {
  if (stop.id === activeStopId) return 'active';
  const activeIdx = stops.findIndex(s => s.id === activeStopId);
  const myIdx = stops.findIndex(s => s.id === stop.id);
  if (activeIdx >= 0 && myIdx < activeIdx) return 'past';
  return 'future';
}

function formatDateRange(start: string, end: string): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  return `${months[s.getMonth()]} ${s.getDate()}–${e.getDate()}`;
}

export function StopsStrip({ stops, activeStopId, onStopPress }: StopsStripProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {stops.map(stop => {
          const state = getStopState(stop, activeStopId, stops);
          const isActive = state === 'active';
          return (
            <TouchableOpacity
              key={stop.id}
              onPress={() => onStopPress(stop.id)}
              activeOpacity={0.75}
              style={[
                styles.pill,
                state === 'past'   && styles.pillPast,
                state === 'future' && styles.pillFuture,
                isActive && {
                  borderColor: stop.color,
                  backgroundColor: stop.color + '1A',
                  minWidth: 160,
                },
              ]}
            >
              <Text style={styles.pillEmoji}>{stop.emoji}</Text>
              <Text style={[
                styles.pillCity,
                isActive          && { color: stop.color },
                state === 'past'  && styles.textPast,
                state === 'future'&& styles.textFuture,
              ]}>
                {stop.city}
              </Text>
              <Text style={[
                styles.pillDate,
                isActive          && { color: stop.color },
                state === 'past'  && styles.textPast,
                state === 'future'&& styles.textFuture,
              ]}>
                {formatDateRange(stop.dates.start, stop.dates.end)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Core.border,
    backgroundColor: 'rgba(252,250,247,0.95)',
  },
  scrollContent: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  pillPast:   { backgroundColor: Semantic.successTint },
  pillFuture: { backgroundColor: Core.surfaceMuted },
  pillEmoji:  { fontSize: 14 },
  pillCity:   { ...Typography.roles.label, color: Core.text },
  pillDate:   { ...Typography.roles.meta,  color: Core.textMuted },
  textPast:   { color: Core.textMuted },
  textFuture: { color: Core.textFaint },
});
```

> **`+ '1A'` hex trick:** appending `1A` to a 6-char hex gives ~10% opacity (`0x1A / 0xFF ≈ 10.2%`). React Native supports 8-digit `#RRGGBBAA` hex on both iOS and Android.

- [ ] **Step 2: TypeScript check**

```bash
cd /home/jstraw4663/jernie-native && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors from `StopsStrip.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/features/jernie/StopsStrip.tsx
git commit -m "feat: add StopsStrip horizontal pill scroll"
```

---

## Task 8: StopSection component

**Files:**
- Create: `src/features/jernie/StopSection.tsx`

- [ ] **Step 1: Create StopSection.tsx**

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Stop, Booking, ItineraryDay } from '@/src/types';
import { Core, Typography, Spacing } from '@/src/design/tokens';
import { TravelCard } from './components/TravelCard';
import { ItineraryDayRow } from './components/ItineraryDayRow';

interface StopSectionProps {
  stop: Stop;
  bookings: Booking[];
  days: ItineraryDay[];
  expandedDayId: string | null;
  onDayPress: (dayId: string | null) => void;
  onSectionLayout: (y: number) => void;
}

export function StopSection({
  stop,
  bookings,
  days,
  expandedDayId,
  onDayPress,
  onSectionLayout,
}: StopSectionProps) {
  return (
    <View onLayout={e => onSectionLayout(e.nativeEvent.layout.y)}>
      <View style={[styles.sectionHeader, { borderLeftColor: stop.color }]}>
        <Text style={styles.emoji}>{stop.emoji}</Text>
        <Text style={styles.cityName}>{stop.city}</Text>
      </View>

      {bookings.map(booking => (
        <TravelCard key={booking.id} booking={booking} />
      ))}

      {days.map((day, idx) => (
        <ItineraryDayRow
          key={day.id}
          day={day}
          dayNumber={idx + 1}
          stopColor={stop.color}
          isExpanded={expandedDayId === day.id}
          onPress={() => onDayPress(expandedDayId === day.id ? null : day.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderLeftWidth: 3,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.base,
    marginTop: Spacing.base,
    backgroundColor: Core.bg,
  },
  emoji:    { fontSize: 20 },
  cityName: { ...Typography.roles.h2Bold, color: Core.text },
});
```

- [ ] **Step 2: TypeScript check**

```bash
cd /home/jstraw4663/jernie-native && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors from `StopSection.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/features/jernie/StopSection.tsx
git commit -m "feat: add StopSection (travel cards + itinerary accordion)"
```

---

## Task 9: Wire up jernie.tsx screen

**Files:**
- Modify: `app/(trips)/[tripId]/(tabs)/jernie.tsx`

- [ ] **Step 1: Replace jernie.tsx with the full screen implementation**

Replace the entire file contents:

```typescript
import React, { useState, useRef } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { DEV_TRIP, DEV_STOPS, DEV_BOOKINGS, DEV_ITINERARY } from '@/src/fixtures/devTrip';
import { getActiveStopId, getAutoExpandDayIndex } from '@/src/domain/trip';
import { getDevNow } from '@/src/utils/devTime';
import { HeroLayer } from '@/src/features/jernie/HeroLayer';
import { CTACardZone } from '@/src/features/jernie/CTACardZone';
import { StopsStrip } from '@/src/features/jernie/StopsStrip';
import { StopSection } from '@/src/features/jernie/StopSection';
import { Core } from '@/src/design/tokens';
import type { Booking } from '@/src/types';

export default function JernieTab() {
  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<string, number>>({});

  const now = getDevNow();
  const activeStopId = getActiveStopId(DEV_STOPS, now);
  const activeStop = DEV_STOPS.find(s => s.id === activeStopId) ?? DEV_STOPS[0];

  const [ctaDismissed, setCtaDismissed] = useState(false);

  const [expandedDayIds, setExpandedDayIds] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(DEV_STOPS.map(s => {
      const days = DEV_ITINERARY[s.id] ?? [];
      const idx = getAutoExpandDayIndex(days, now);
      return [s.id, idx >= 0 ? (days[idx]?.id ?? null) : null];
    }))
  );

  function setExpandedDayId(stopId: string, dayId: string | null) {
    setExpandedDayIds(prev => ({ ...prev, [stopId]: dayId }));
  }

  function bookingsForStop(stopId: string): Booking[] {
    return DEV_BOOKINGS.filter(b => b.stopId === stopId);
  }

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
        <HeroLayer trip={DEV_TRIP} activeStop={activeStop} />

        {/* 1 — always-rendered wrapper keeps stickyHeaderIndices[1] stable when CTA dismissed */}
        <View>
          {!ctaDismissed && (
            <CTACardZone
              trip={DEV_TRIP}
              stops={DEV_STOPS}
              bookings={DEV_BOOKINGS}
              onDismiss={() => setCtaDismissed(true)}
            />
          )}
        </View>

        {/* 2 — stacks below CTA when both are sticky */}
        <StopsStrip
          stops={DEV_STOPS}
          activeStopId={activeStopId}
          onStopPress={handleStopPress}
        />

        {/* 3+ */}
        {DEV_STOPS.map(stop => (
          <StopSection
            key={stop.id}
            stop={stop}
            bookings={bookingsForStop(stop.id)}
            days={DEV_ITINERARY[stop.id] ?? []}
            expandedDayId={expandedDayIds[stop.id] ?? null}
            onDayPress={dayId => setExpandedDayId(stop.id, dayId)}
            onSectionLayout={y => { sectionOffsets.current[stop.id] = y; }}
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

- [ ] **Step 2: Run full TypeScript check**

```bash
cd /home/jstraw4663/jernie-native && npx tsc --noEmit 2>&1
```

Expected: no errors. If you see errors, they will point to the exact line — fix before continuing.

- [ ] **Step 3: Run all tests**

```bash
cd /home/jstraw4663/jernie-native && npx jest --no-coverage 2>&1 | tail -20
```

Expected: all tests pass (existing 17 + 5 new `getActiveStopId` = 22 tests).

- [ ] **Step 4: Commit**

```bash
git add app/\(trips\)/\[tripId\]/\(tabs\)/jernie.tsx
git commit -m "feat: wire up jernie.tsx with all 4 layers and fixture data"
```

---

## Task 10: Verify on device

- [ ] **Step 1: Start Metro**

```bash
cd /home/jstraw4663/jernie-native && npx expo start
```

- [ ] **Step 2: Open the app on iPhone via the dev client**

Scan the QR code or press `i` if the simulator is running.

- [ ] **Step 3: Verify the golden path**

Check each of these manually:

| Feature | Expected |
|---|---|
| Hero | Dark navy-to-blue gradient, "Portland" title, "Pre-trip" amber pill, "Maine Summer 2026" trip pill |
| CTA card | Overlaps hero bottom, shows 50% progress bar, 2 checked rows (✈️ Flights, 🏨 Stays), 2 open rows (🚗 🍽️) with colored CTAs |
| Dismiss CTA | Tap ✕ → card disappears, StopsStrip slides up to top |
| Stops strip | Two pills: Portland (active, navy border) and Bar Harbor (future, muted) |
| Stop tap | Tap "Bar Harbor" pill → ScrollView scrolls to Bar Harbor section |
| StopSection | Portland section shows: JetBlue flight card, Press Hotel card, Enterprise rental card, then Day 1/Day 2 accordion headers |
| Accordion expand | Tap "Day 1" → items list expands (arrival, Duckfat, Head Light) |
| Accordion collapse | Tap "Day 1" again → collapses |
| Accordion single-open | Tap "Day 2" while Day 1 is open → Day 1 closes, Day 2 opens |
| Sticky strip | Scroll past hero → StopsStrip sticks at top |

- [ ] **Step 4: Final commit if any last-minute fixes applied**

```bash
git add -p  # stage only intentional changes
git commit -m "fix: <describe any last-minute visual tweaks>"
```

---

## Spec coverage check

| Spec section | Covered by task |
|---|---|
| §2 Fixture data | Task 2 |
| §3 Component architecture | Tasks 3–8, file structure |
| §4 ScrollView + stickyHeaderIndices | Task 9 |
| §5 HeroLayer | Task 5 |
| §6 CTACardZone | Task 6 |
| §7 StopsStrip | Task 7 |
| §8 StopSection | Task 8 |
| §9 TravelCard | Task 3 |
| §10 ItineraryDayRow | Task 4 |
| §11 State management | Task 9 |
| §12 expo-linear-gradient | Task 0 |
| TypeColors mapping (§9 note) | Task 3, `BOOKING_TYPE_COLOR` constant |
| stickyHeaderIndices stability (§4 note) | Task 9, always-rendered CTA wrapper |
| `getAutoExpandDayIndex` → dayId conversion (§11) | Task 9, `days[idx]?.id ?? null` |
| `getActiveStopId` pre-trip default | Task 1 |
