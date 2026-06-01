# Jernie Tab UI Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign StopsStrip, StopSection, TravelCard, and ItineraryDayRow to match the PWA mockup design language using the existing token system.

**Architecture:** Pure visual changes — no data layer, no context, no hooks touched. `hexWithAlpha` extracted to a shared utility first so all four components can share it. Each component is a self-contained task that TypeScript-checks clean and leaves 63 tests passing.

**Tech Stack:** React Native StyleSheet, Reanimated v4 (ItineraryDayRow animation unchanged), react-native-mmkv, existing `src/design/tokens.ts` token system.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/utils/colors.ts` | `hexWithAlpha` shared helper |
| Modify | `src/features/jernie/StopsStrip.tsx` | PWA track design: connector line, dot states, expanded active pill |
| Modify | `src/features/jernie/StopSection.tsx` | Tinted header card, daysWrapper, thread stopColor to TravelCard |
| Modify | `src/features/jernie/components/TravelCard.tsx` | Type-split: FlightCard (navy gradient), HotelCard, RentalCard, RestaurantCard (tinted surface) |
| Modify | `src/features/jernie/components/ItineraryDayRow.tsx` | Card wrapper; import hexWithAlpha from colors.ts |

---

## Task 0: Extract `hexWithAlpha` to shared utility

**Files:**
- Create: `src/utils/colors.ts`
- Modify: `src/features/jernie/components/ItineraryDayRow.tsx`

- [ ] **Step 1: Create `src/utils/colors.ts`**

```typescript
export function hexWithAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
```

- [ ] **Step 2: Update `ItineraryDayRow.tsx` to import from the new utility**

In `src/features/jernie/components/ItineraryDayRow.tsx`, replace the local `hexWithAlpha` function definition (the block starting with `function hexWithAlpha(hex: string, alpha: number): string {`) with an import at the top of the file:

```typescript
import { hexWithAlpha } from '@/src/utils/colors';
```

Remove the local function body entirely.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Run tests**

```bash
npx jest
```

Expected: 63 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/colors.ts src/features/jernie/components/ItineraryDayRow.tsx
git commit -m "refactor: extract hexWithAlpha to src/utils/colors.ts"
```

---

## Task 1: StopsStrip — PWA track design

**Files:**
- Modify: `src/features/jernie/StopsStrip.tsx`

Replace the entire file. The new design has a fixed connector track line and a colored progress line sitting behind a scrollable content layer, all inside a `position: 'relative'` container.

**Key layout facts:**
- Container height is fixed at 76px (fits 40px emoji circle + 18px vertical padding each side).
- Connector lines are the first children in JSX → painted behind the ScrollView.
- Progress width = `(activeIdx / (stops.length - 1)) * trackWidth`. Container width is measured via `onLayout`; initial value from `Dimensions.get('window').width` avoids a flash of zero-width progress.
- The ScrollView uses `StyleSheet.absoluteFill` to overlay the connector lines.

- [ ] **Step 1: Replace `src/features/jernie/StopsStrip.tsx` entirely**

```typescript
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Dimensions,
} from 'react-native';
import type { Stop } from '@/src/types';
import { Core, Semantic, Typography, Radius, Shadow, Spacing } from '@/src/design/tokens';
import { formatDateRange } from '@/src/utils/dates';
import { hexWithAlpha } from '@/src/utils/colors';

interface StopsStripProps {
  stops: Stop[];
  activeStopId: string | null;
  onStopPress: (stopId: string) => void;
}

type StopState = 'active' | 'past' | 'future';

function getStopState(stop: Stop, activeStopId: string | null, stops: Stop[]): StopState {
  if (stop.id === activeStopId) return 'active';
  const activeIdx = stops.findIndex(s => s.id === activeStopId);
  const myIdx     = stops.findIndex(s => s.id === stop.id);
  if (activeIdx >= 0 && myIdx < activeIdx) return 'past';
  return 'future';
}

const STRIP_HEIGHT = 76;
const H_PADDING    = 28;

export function StopsStrip({ stops, activeStopId, onStopPress }: StopsStripProps) {
  const [trackWidth, setTrackWidth] = useState(
    () => Dimensions.get('window').width - H_PADDING * 2,
  );

  const activeIdx  = stops.findIndex(s => s.id === activeStopId);
  const activeStop = stops[activeIdx] ?? stops[0];
  const ratio      = stops.length > 1 ? Math.max(0, activeIdx) / (stops.length - 1) : 0;
  const progressW  = trackWidth * ratio;

  return (
    <View
      style={styles.container}
      onLayout={e => setTrackWidth(e.nativeEvent.layout.width - H_PADDING * 2)}
    >
      {/* Connector track line — fixed behind scroll content (JSX order = paint order) */}
      <View style={styles.trackLine} pointerEvents="none" />

      {/* Colored progress line up to active stop */}
      {activeStop && (
        <View
          style={[
            styles.progressLine,
            {
              width: progressW,
              backgroundColor: activeStop.color,
              shadowColor: activeStop.color,
            },
          ]}
          pointerEvents="none"
        />
      )}

      {/* Scrollable stop items painted on top */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={StyleSheet.absoluteFill}
      >
        {stops.map(stop => {
          const state = getStopState(stop, activeStopId, stops);

          if (state === 'active') {
            return (
              <TouchableOpacity
                key={stop.id}
                onPress={() => onStopPress(stop.id)}
                activeOpacity={0.8}
                style={[
                  styles.activePill,
                  {
                    borderColor: hexWithAlpha(stop.color, 0.28),
                    ...Shadow.cardResting,
                    shadowColor: stop.color,
                  },
                ]}
              >
                <View style={[styles.activeEmojiCircle, { backgroundColor: hexWithAlpha(stop.color, 0.14) }]}>
                  <Text style={styles.activeEmoji}>{stop.emoji}</Text>
                </View>
                <View>
                  <Text style={[styles.activeCity, { color: stop.color }]}>{stop.city}</Text>
                  <Text style={styles.activeDates}>{formatDateRange(stop.dates.start, stop.dates.end)}</Text>
                </View>
              </TouchableOpacity>
            );
          }

          const isPast = state === 'past';
          return (
            <TouchableOpacity
              key={stop.id}
              onPress={() => onStopPress(stop.id)}
              activeOpacity={0.7}
              style={styles.dotStop}
            >
              <View style={[styles.dot, isPast ? styles.dotPast : styles.dotFuture]}>
                <Text style={styles.dotEmoji}>{stop.emoji}</Text>
              </View>
              <Text
                style={[styles.dotName, isPast ? styles.dotNamePast : styles.dotNameFuture]}
                numberOfLines={1}
              >
                {stop.city}
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
    height: STRIP_HEIGHT,
    backgroundColor: 'rgba(252,250,247,0.95)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Core.border,
  },
  trackLine: {
    position: 'absolute',
    left: H_PADDING,
    right: H_PADDING,
    top: STRIP_HEIGHT / 2 - 1,
    height: 2,
    backgroundColor: 'rgba(120,113,106,0.18)',
  },
  progressLine: {
    position: 'absolute',
    left: H_PADDING,
    top: STRIP_HEIGHT / 2 - 1,
    height: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.38,
    shadowRadius: 4,
    elevation: 2,
  },
  scrollContent: {
    paddingHorizontal: H_PADDING,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: STRIP_HEIGHT,
  },
  // Active stop — expanded pill
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: Core.surface,
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingLeft: 7,
    paddingRight: 14,
    paddingVertical: 7,
    minWidth: 172,
  },
  activeEmojiCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeEmoji:  { fontSize: 21 },
  activeCity:   { ...Typography.roles.label, fontWeight: '700' as const },
  activeDates:  { ...Typography.roles.meta, color: Core.textMuted, marginTop: 2 },
  // Dot stops (past / future)
  dotStop: {
    alignItems: 'center',
    gap: 5,
    width: 70,
  },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  dotPast:   { backgroundColor: 'rgba(62,123,82,0.12)',  borderColor: 'rgba(62,123,82,0.32)' },
  dotFuture: { backgroundColor: 'rgba(120,113,106,0.08)', borderColor: 'rgba(120,113,106,0.22)' },
  dotEmoji:      { fontSize: 15 },
  dotName:       { ...Typography.roles.meta, fontSize: 11, fontWeight: '600' as const, textAlign: 'center' },
  dotNamePast:   { color: Semantic.success },
  dotNameFuture: { color: Core.textFaint },
});
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Run tests**

```bash
npx jest
```

Expected: 63 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/features/jernie/StopsStrip.tsx
git commit -m "feat: redesign StopsStrip with PWA track line, dot states, and active pill"
```

---

## Task 2: StopSection — header card, daysWrapper, thread stopColor

**Files:**
- Modify: `src/features/jernie/StopSection.tsx`

- [ ] **Step 1: Replace `src/features/jernie/StopSection.tsx` entirely**

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Stop, Booking, ItineraryDay } from '@/src/types';
import { Core, Typography, Radius, Spacing } from '@/src/design/tokens';
import { formatDateRange } from '@/src/utils/dates';
import { hexWithAlpha } from '@/src/utils/colors';
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
  stop, bookings, days, expandedDayId, onDayPress, onSectionLayout,
}: StopSectionProps) {
  return (
    <View onLayout={e => onSectionLayout(e.nativeEvent.layout.y)}>
      {/* Stop header — tinted rounded card */}
      <View
        style={[
          styles.headerCard,
          {
            backgroundColor: hexWithAlpha(stop.color, 0.07),
            borderColor:     hexWithAlpha(stop.color, 0.18),
          },
        ]}
      >
        <View style={[styles.emojiSquare, { backgroundColor: hexWithAlpha(stop.color, 0.15) }]}>
          <Text style={styles.emoji}>{stop.emoji}</Text>
        </View>
        <View>
          <Text style={styles.cityName}>{stop.city}</Text>
          <Text style={styles.dates}>{formatDateRange(stop.dates.start, stop.dates.end)}</Text>
        </View>
      </View>

      {/* Travel cards — pass stopColor for tinted hotel/rental cards */}
      {bookings.map(booking => (
        <TravelCard key={booking.id} booking={booking} stopColor={stop.color} />
      ))}

      {/* Day cards — grouped with gap */}
      <View style={styles.daysWrapper}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.xl,
    margin: Spacing.sm,
    marginTop: Spacing.base,
    padding: Spacing.md,
  },
  emojiSquare: {
    width: 34,
    height: 34,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji:    { fontSize: 18 },
  cityName: { ...Typography.roles.h2Bold, color: Core.text },
  dates:    { ...Typography.roles.meta,   color: Core.textMuted, marginTop: 2 },
  daysWrapper: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.sm,
    marginBottom: Spacing.base,
    gap: 6,
  },
});
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: one error — `TravelCard` doesn't accept `stopColor` yet. That's fine; fix it in the next task.

- [ ] **Step 3: Run tests**

```bash
npx jest
```

Expected: 63 tests pass (tests don't render StopSection).

- [ ] **Step 4: Commit**

```bash
git add src/features/jernie/StopSection.tsx
git commit -m "feat: redesign StopSection header card and add daysWrapper grouping"
```

---

## Task 3: TravelCard — type-specific visual designs

**Files:**
- Modify: `src/features/jernie/components/TravelCard.tsx`

Add `stopColor: string` prop and split into four visually distinct card designs. The `BOOKING_TYPE_COLOR` map and old accent-bar shell are removed entirely.

- [ ] **Step 1: Replace `src/features/jernie/components/TravelCard.tsx` entirely**

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Booking } from '@/src/types';
import { Brand, Core, Semantic, TypeColors, Typography, Radius, Shadow, Spacing } from '@/src/design/tokens';
import { hexWithAlpha } from '@/src/utils/colors';

interface TravelCardProps {
  booking: Booking;
  stopColor: string;
}

export function TravelCard({ booking, stopColor }: TravelCardProps) {
  if (booking.type === 'flight')     return <FlightCard booking={booking} />;
  if (booking.type === 'hotel')      return <HotelCard  booking={booking} stopColor={stopColor} />;
  if (booking.type === 'rental')     return <RentalCard booking={booking} stopColor={stopColor} />;
  if (booking.type === 'restaurant') return <RestaurantCard booking={booking} />;
  return null;
}

// ── Flight card — dark navy gradient ──────────────────────────────────────────

function FlightCard({ booking }: { booking: Extract<Booking, { type: 'flight' }> }) {
  return (
    <View style={[styles.flightCard, Shadow.cardHover]}>
      <View style={styles.flightTop}>
        <Text style={styles.flightTag}>{booking.airline} · {booking.flightNumber}</Text>
        <View style={styles.onTimeChip}>
          <Text style={styles.onTimeText}>On time</Text>
        </View>
      </View>

      <View style={styles.flightRoute}>
        <View style={styles.routeEndpoint}>
          <Text style={styles.airportCode}>{booking.origin}</Text>
          <Text style={styles.flightTime}>{booking.departureTime}</Text>
        </View>
        <Text style={styles.routeArrow}>→</Text>
        <View style={[styles.routeEndpoint, styles.routeEndpointRight]}>
          <Text style={styles.airportCode}>{booking.destination}</Text>
          <Text style={styles.flightTime}>{booking.arrivalTime}</Text>
        </View>
      </View>

      {booking.confirmationCode && (
        <View style={styles.flightFooter}>
          <Text style={styles.flightFooterLabel}>Confirmation</Text>
          <Text style={styles.flightFooterValue}>{booking.confirmationCode}</Text>
        </View>
      )}
    </View>
  );
}

// ── Hotel card — stop-color tinted surface ────────────────────────────────────

function HotelCard({ booking, stopColor }: { booking: Extract<Booking, { type: 'hotel' }>, stopColor: string }) {
  const nights = daysBetween(booking.checkIn, booking.checkOut);
  return (
    <View
      style={[
        styles.surfaceCard,
        { borderColor: hexWithAlpha(stopColor, 0.18) },
      ]}
    >
      <View style={[styles.typeIcon, { backgroundColor: hexWithAlpha(stopColor, 0.12) }]}>
        <Text style={styles.typeEmoji}>🏨</Text>
      </View>
      <View style={styles.surfaceCardBody}>
        <Text style={styles.surfaceCardName}>{booking.hotelName}</Text>
        <Text style={styles.surfaceCardMeta}>
          {shortDate(booking.checkIn)} – {shortDate(booking.checkOut)}
        </Text>
        <Text style={[styles.surfaceCardAccent, { color: stopColor }]}>
          {nights} night{nights !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  );
}

// ── Rental card — stop-color tinted surface ───────────────────────────────────

function RentalCard({ booking, stopColor }: { booking: Extract<Booking, { type: 'rental' }>, stopColor: string }) {
  return (
    <View
      style={[
        styles.surfaceCard,
        { borderColor: hexWithAlpha(stopColor, 0.18) },
      ]}
    >
      <View style={[styles.typeIcon, { backgroundColor: hexWithAlpha(stopColor, 0.12) }]}>
        <Text style={styles.typeEmoji}>🚗</Text>
      </View>
      <View style={styles.surfaceCardBody}>
        <Text style={styles.surfaceCardName}>
          {booking.company}{booking.carType ? ` · ${booking.carType}` : ''}
        </Text>
        <Text style={styles.surfaceCardMeta}>
          {shortDate(booking.pickupDate)} – {shortDate(booking.dropoffDate)}
        </Text>
        <Text style={styles.surfaceCardMeta}>{booking.pickupLocation}</Text>
      </View>
    </View>
  );
}

// ── Restaurant card — food-color tinted surface ───────────────────────────────

function RestaurantCard({ booking }: { booking: Extract<Booking, { type: 'restaurant' }> }) {
  const foodColor = TypeColors.food;
  return (
    <View
      style={[
        styles.surfaceCard,
        { borderColor: hexWithAlpha(foodColor, 0.18) },
      ]}
    >
      <View style={[styles.typeIcon, { backgroundColor: hexWithAlpha(foodColor, 0.10) }]}>
        <Text style={styles.typeEmoji}>🍽️</Text>
      </View>
      <View style={styles.surfaceCardBody}>
        <Text style={styles.surfaceCardName}>{booking.restaurantName}</Text>
        <Text style={styles.surfaceCardMeta}>{shortDate(booking.date)}{booking.time ? ` · ${booking.time}` : ''}</Text>
        {booking.partySize && (
          <Text style={[styles.surfaceCardAccent, { color: foodColor }]}>
            Party of {booking.partySize}
          </Text>
        )}
      </View>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysBetween(start: string, end: string): number {
  const a = new Date(start + 'T12:00:00');
  const b = new Date(end   + 'T12:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function shortDate(iso: string): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date(iso + 'T12:00:00');
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Flight card
  flightCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    borderRadius: 18,
    backgroundColor: Brand.navy,
    padding: 14,
  },
  flightTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  flightTag: {
    ...Typography.roles.labelCaps,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.8,
  },
  onTimeChip: {
    height: 20,
    paddingHorizontal: 8,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(62,123,82,0.30)',
    borderWidth: 1,
    borderColor: 'rgba(100,200,140,0.30)',
    justifyContent: 'center',
  },
  onTimeText: {
    ...Typography.roles.labelCaps,
    color: '#a0f0c0',
    letterSpacing: 0.5,
  },
  flightRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  routeEndpoint: { flex: 1, alignItems: 'flex-start' },
  routeEndpointRight: { alignItems: 'flex-end' },
  airportCode: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: Core.white,
    fontFamily: 'DMSans',
  },
  flightTime: {
    ...Typography.roles.label,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
  },
  routeArrow: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 8,
  },
  flightFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
  flightFooterLabel: {
    ...Typography.roles.labelCaps,
    color: 'rgba(255,255,255,0.40)',
    letterSpacing: 0.7,
  },
  flightFooterValue: {
    ...Typography.roles.label,
    color: 'rgba(255,255,255,0.90)',
  },
  // Surface cards (hotel, rental, restaurant)
  surfaceCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    borderRadius: Radius.xl,
    borderWidth: 1,
    backgroundColor: Core.surface,
    padding: Spacing.md,
    ...Shadow.cardResting,
  },
  typeIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  typeEmoji: { fontSize: 17 },
  surfaceCardBody:   { flex: 1 },
  surfaceCardName:   { ...Typography.roles.label, fontWeight: '700' as const, color: Core.text, marginBottom: 3 },
  surfaceCardMeta:   { ...Typography.roles.meta, color: Core.textMuted, marginBottom: 1 },
  surfaceCardAccent: { ...Typography.roles.label, marginTop: 3 },
});
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Run tests**

```bash
npx jest
```

Expected: 63 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/features/jernie/components/TravelCard.tsx
git commit -m "feat: redesign TravelCard with type-specific flight/hotel/rental/restaurant layouts"
```

---

## Task 4: ItineraryDayRow — card wrapper

**Files:**
- Modify: `src/features/jernie/components/ItineraryDayRow.tsx`

The only change is the `wrapper` style. Everything else — animations, layout, item rendering — is untouched.

- [ ] **Step 1: Update the `wrapper` style in `ItineraryDayRow.tsx`**

Find the `styles` declaration in `src/features/jernie/components/ItineraryDayRow.tsx` and replace the `wrapper` entry:

Old:
```typescript
  wrapper: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Core.border,
  },
```

New:
```typescript
  wrapper: {
    borderRadius: Radius.lg,
    backgroundColor: Core.surface,
    borderWidth: 1,
    borderColor: Core.border,
    overflow: 'hidden',
  },
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Run tests**

```bash
npx jest
```

Expected: 63 tests pass. The snapshot tests render `TripLoadingScreen` and `TripErrorScreen`, not `ItineraryDayRow`, so they are unaffected.

- [ ] **Step 4: Commit**

```bash
git add src/features/jernie/components/ItineraryDayRow.tsx
git commit -m "feat: convert ItineraryDayRow to card style with border-radius and border"
```

---

## Task 5: Final verification and tag

- [ ] **Step 1: Full test suite**

```bash
npx jest
```

Expected:
```
Test Suites: 9 passed, 9 total
Tests:       63 passed, 63 total
```

- [ ] **Step 2: TypeScript strict check**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 3: Verify working tree is clean**

```bash
git status
```

Expected: `nothing to commit, working tree clean`

- [ ] **Step 4: Tag sprint completion**

```bash
git tag v0.4.0-sprint2c
```
