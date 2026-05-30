# Jernie Tab Sprint 2a — Animations & UX Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Reanimated hero collapse, accordion height animations, scroll-position stop tracking, MMKV CTA persistence, and minor type/perf cleanup to the Jernie tab — all still on fixture data.

**Architecture:** `jernie.tsx` becomes the animation driver — it owns the `scrollY` SharedValue and passes it to `HeroLayer`. `ItineraryDayRow` manages its own internal spring independently. A `runOnJS` bridge in the scroll handler keeps `visibleStopId` in sync with scroll position on the JS thread.

**Tech Stack:** Reanimated v4 (`useSharedValue`, `useAnimatedStyle`, `useAnimatedScrollHandler`, `useAnimatedRef`, `withSpring`, `interpolate`, `runOnJS`, `scrollTo`), react-native-mmkv v4

---

## File Map

| File | Change |
|---|---|
| `src/types.ts` | Add `RestaurantBooking` interface; update `Booking` union |
| `src/features/jernie/components/ItineraryDayRow.tsx` | Animated height + chevron rotation |
| `src/features/jernie/HeroLayer.tsx` | Animated collapse, cross-fade layouts, new props |
| `app/(trips)/[tripId]/(tabs)/jernie.tsx` | `Animated.ScrollView`, `scrollY`, `visibleStopId`, MMKV CTA, `useMemo`/`useCallback` |

---

## Task 0: Add RestaurantBooking type

**Files:**
- Modify: `src/types.ts`

- [ ] **Add `RestaurantBooking` interface and update the `Booking` union**

In `src/types.ts`, replace the `RentalBooking` block and `Booking` type at lines 111–127:

```typescript
export interface RentalBooking {
  id: string;
  tripId: string;
  stopId: string;
  type: 'rental';
  company: string;
  carType?: string;
  pickupDate: string;
  pickupTime?: string;
  dropoffDate: string;
  dropoffTime?: string;
  pickupLocation: string;
  dropoffLocation: string;
  confirmationCode?: string;
}

export interface RestaurantBooking {
  id: string;
  tripId: string;
  stopId: string;
  type: 'restaurant';
  restaurantName: string;
  date: string;         // YYYY-MM-DD
  time?: string;        // "7:30 PM"
  partySize?: number;
  confirmationCode?: string;
}

export type Booking = FlightBooking | HotelBooking | RentalBooking | RestaurantBooking;
```

- [ ] **Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. `TravelCard.tsx` already has `restaurant: TypeColors.food` in `BOOKING_TYPE_COLOR` and uses `booking.type === 'flight'` / `'hotel'` / `'rental'` conditionals — the new union member falls through silently (no card rendered for restaurant bookings in Sprint 2a).

- [ ] **Run tests**

```bash
npx jest
```

Expected: 42 tests pass.

- [ ] **Commit**

```bash
git add src/types.ts
git commit -m "feat: add RestaurantBooking type to Booking union"
```

---

## Task 1: Accordion height + chevron animation

**Files:**
- Modify: `src/features/jernie/components/ItineraryDayRow.tsx`

- [ ] **Replace `ItineraryDayRow.tsx` with the animated version**

Full file replacement — every change is noted inline via comments:

```typescript
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import type { ItineraryDay, ItineraryItemCategory } from '@/src/types';
import { Core, TypeColors, Typography, Radius, Spacing } from '@/src/design/tokens';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// Height of each item row (paddingVertical:6 × 2 + ~32px text line height)
const ITEM_ROW_HEIGHT = 44;
const ITEM_LIST_BOTTOM_PAD = Spacing.sm; // 8px

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

  // Calculated from item count — no off-screen measurement needed
  const contentHeight = day.items.length * ITEM_ROW_HEIGHT + ITEM_LIST_BOTTOM_PAD;

  const animatedHeight = useSharedValue(0);
  const chevronProgress = useSharedValue(0);

  useEffect(() => {
    animatedHeight.value = withSpring(isExpanded ? contentHeight : 0, {
      stiffness: 380,
      damping: 35,
    });
    chevronProgress.value = withSpring(isExpanded ? 1 : 0, {
      stiffness: 380,
      damping: 35,
    });
  }, [isExpanded, contentHeight]);

  const itemListStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
    overflow: 'hidden',
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{
      rotate: `${interpolate(chevronProgress.value, [0, 1], [0, 90], Extrapolation.CLAMP)}deg`,
    }],
  }));

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
          {/* Chevron wrapped in Animated.View for rotation */}
          <Animated.View style={chevronStyle}>
            <Text style={styles.chevron}>›</Text>
          </Animated.View>
        </View>
      </TouchableOpacity>

      {/* Always rendered — height springs to 0 when collapsed */}
      <Animated.View style={itemListStyle}>
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
      </Animated.View>
    </View>
  );
}

function hexWithAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return `rgba(0,0,0,${alpha})`;
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
  chevron:    { fontSize: 20, color: Core.textMuted },
  // chevronOpen removed — rotation is now Reanimated-driven
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

- [ ] **Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Run tests**

```bash
npx jest
```

Expected: 42 tests pass.

- [ ] **Commit**

```bash
git add src/features/jernie/components/ItineraryDayRow.tsx
git commit -m "feat: animate accordion height and chevron rotation with Reanimated spring"
```

---

## Task 2: Hero collapse animation + jernie.tsx scroll setup

These two files are tightly coupled — `HeroLayer` gains new required props that `jernie.tsx` must supply in the same task.

**Files:**
- Modify: `src/features/jernie/HeroLayer.tsx`
- Modify: `app/(trips)/[tripId]/(tabs)/jernie.tsx`

- [ ] **Replace `HeroLayer.tsx` with the animated version**

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Trip, Stop } from '@/src/types';
import { Typography, Radius, Spacing, Semantic } from '@/src/design/tokens';
import { formatDateRange } from '@/src/utils/dates';

interface HeroLayerProps {
  trip: Trip;
  activeStop: Stop;   // date-based — drives phase pill label
  visibleStop: Stop;  // scroll-position — drives compact strip city/emoji
  scrollY: SharedValue<number>;
}

export function HeroLayer({ trip, activeStop, visibleStop, scrollY }: HeroLayerProps) {
  const insets = useSafeAreaInsets();

  // Animated container height: 280px → 120px
  const heroStyle = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [0, 120], [280, 120], Extrapolation.CLAMP),
  }));

  // Expanded content (pills + large city + subtitle): fades out 0→80
  const expandedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [1, 0], Extrapolation.CLAMP),
  }));

  // Compact strip (emoji + city + phase pill): fades in 80→120
  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [80, 120], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View style={[styles.container, heroStyle]}>
      {/* LinearGradient fills the animated container */}
      <LinearGradient
        colors={trip.colorPack.heroGradient}
        style={[StyleSheet.absoluteFill, styles.gradient]}
      />

      {/* Expanded layout — fades out as hero shrinks */}
      <Animated.View
        style={[
          styles.expandedContent,
          { paddingTop: insets.top + Spacing.base },
          expandedStyle,
        ]}
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
      </Animated.View>

      {/* Compact strip — fades in as hero shrinks, pinned to bottom */}
      <Animated.View style={[styles.compactStrip, compactStyle]}>
        <Text style={styles.compactCity}>
          {visibleStop.emoji}{'  '}{visibleStop.city}
        </Text>
        <View style={styles.phasePill}>
          <Text style={styles.phaseText}>Pre-trip</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomLeftRadius: Radius.hero,
    borderBottomRightRadius: Radius.hero,
    marginBottom: -4,
    overflow: 'hidden',
  },
  gradient: {
    borderBottomLeftRadius: Radius.hero,
    borderBottomRightRadius: Radius.hero,
  },
  expandedContent: {
    flex: 1,
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
  compactStrip: {
    position: 'absolute',
    bottom: Spacing.xl,
    left: Spacing.base,
    right: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactCity: {
    ...Typography.roles.h3,
    color: '#FFFFFF',
  },
});
```

- [ ] **Replace `jernie.tsx` with the scroll-wired version**

```typescript
import React, { useState, useRef, useMemo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedRef,
  scrollTo,
  runOnJS,
} from 'react-native-reanimated';
import { createMMKV } from 'react-native-mmkv';
import { DEV_TRIP, DEV_STOPS, DEV_BOOKINGS, DEV_ITINERARY } from '@/src/fixtures/devTrip';
import { getActiveStopId, getAutoExpandDayIndex } from '@/src/domain/trip';
import { getDevNow } from '@/src/utils/devTime';
import { HeroLayer } from '@/src/features/jernie/HeroLayer';
import { CTACardZone } from '@/src/features/jernie/CTACardZone';
import { StopsStrip } from '@/src/features/jernie/StopsStrip';
import { StopSection } from '@/src/features/jernie/StopSection';
import { Core } from '@/src/design/tokens';

const uiStorage = createMMKV({ id: 'jernie-ui' });

// Approximate combined height of sticky CTA zone + StopsStrip.
// Used to trigger stop-pill highlight when a section header enters the viewport.
const STICKY_HEADER_HEIGHT = 130;

export default function JernieTab() {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const sectionOffsets = useRef<Record<string, number>>({});
  const scrollY = useSharedValue(0);

  const now = getDevNow();
  const activeStopId = getActiveStopId(DEV_STOPS, now);
  const activeStop = DEV_STOPS.find(s => s.id === activeStopId) ?? DEV_STOPS[0];

  const ctaKey = `cta_dismissed_${DEV_TRIP.id}`;
  const [ctaDismissed, setCtaDismissed] = useState(
    () => uiStorage.getBoolean(ctaKey) ?? false
  );

  const [visibleStopId, setVisibleStopId] = useState<string>(
    activeStopId ?? DEV_STOPS[0].id
  );
  const visibleStop = DEV_STOPS.find(s => s.id === visibleStopId) ?? DEV_STOPS[0];

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

  const bookingsByStop = useMemo(
    () => Object.fromEntries(
      DEV_STOPS.map(s => [s.id, DEV_BOOKINGS.filter(b => b.stopId === s.id)])
    ),
    [] // fixture data is module-level constant — no deps needed
  );

  const handleStopPress = useCallback((stopId: string) => {
    const offset = sectionOffsets.current[stopId];
    if (offset !== undefined) {
      scrollTo(scrollRef, 0, offset, true);
    }
  }, [scrollRef]);

  const handleDayPress = useCallback((stopId: string, dayId: string | null) => {
    setExpandedDayId(stopId, dayId);
  }, []);

  const handleSectionLayout = useCallback((stopId: string, y: number) => {
    sectionOffsets.current[stopId] = y;
  }, []);

  // Runs on JS thread via runOnJS — determines which stop section is visible
  function updateVisibleStop(y: number) {
    const offsets = sectionOffsets.current;
    let newId = DEV_STOPS[0].id;
    for (const stop of DEV_STOPS) {
      const offset = offsets[stop.id];
      if (offset !== undefined && y >= offset - STICKY_HEADER_HEIGHT) {
        newId = stop.id;
      }
    }
    // Guard prevents re-render on every scroll event when stop hasn't changed
    setVisibleStopId(prev => (prev === newId ? prev : newId));
  }

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      runOnJS(updateVisibleStop)(event.contentOffset.y);
    },
  });

  function handleDismissCTA() {
    uiStorage.set(ctaKey, true);
    setCtaDismissed(true);
  }

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        stickyHeaderIndices={[1, 2]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustKeyboardInsets={false}
      >
        {/* 0 — scrolls away, collapses */}
        <HeroLayer
          trip={DEV_TRIP}
          activeStop={activeStop}
          visibleStop={visibleStop}
          scrollY={scrollY}
        />

        {/* 1 — always-rendered wrapper keeps stickyHeaderIndices[1] stable */}
        <View>
          {!ctaDismissed && (
            <CTACardZone
              trip={DEV_TRIP}
              stops={DEV_STOPS}
              onDismiss={handleDismissCTA}
            />
          )}
        </View>

        {/* 2 — stacks below CTA when both are sticky */}
        <StopsStrip
          stops={DEV_STOPS}
          activeStopId={visibleStopId}
          onStopPress={handleStopPress}
        />

        {/* 3+ — one section per stop */}
        {DEV_STOPS.map(stop => (
          <StopSection
            key={stop.id}
            stop={stop}
            bookings={bookingsByStop[stop.id] ?? []}
            days={DEV_ITINERARY[stop.id] ?? []}
            expandedDayId={expandedDayIds[stop.id] ?? null}
            onDayPress={dayId => handleDayPress(stop.id, dayId)}
            onSectionLayout={y => handleSectionLayout(stop.id, y)}
          />
        ))}

        <View style={styles.bottomPad} />
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Core.bg },
  bottomPad: { height: 48 },
});
```

- [ ] **Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors. Both new `HeroLayer` props (`visibleStop`, `scrollY`) are now supplied.

- [ ] **Run tests**

```bash
npx jest
```

Expected: 42 tests pass.

- [ ] **Commit**

```bash
git add src/features/jernie/HeroLayer.tsx app/\(trips\)/\[tripId\]/\(tabs\)/jernie.tsx
git commit -m "feat: hero collapse animation and scroll-position stop tracking"
```

---

## Task 3: Verify on device

This task has no code changes — it validates that the animations work correctly on the iPhone before tagging.

- [ ] **Ensure Metro is running**

```bash
npx expo start
```

- [ ] **Open the app on iPhone and verify each animation**

Check each of the following:

1. **Hero collapse** — scroll down slowly. Hero should shrink from 280px to 120px. Expanded content (trip pill, large city name, subtitle) should fade out. Compact strip (emoji + city name + Pre-trip pill) should fade in. No jank.

2. **Accordion spring** — tap any Day row to expand. Content should spring open with height animation. Tap again — springs closed. Chevron should rotate 90° open and back on close.

3. **Stop pill tracking** — scroll past the Portland section into Bar Harbor. The Bar Harbor pill in the Stops Strip should become active (navy border, tinted background). Scroll back up — Portland pill re-activates.

4. **CTA dismiss persistence** — dismiss the CTA card (tap ✕). Force-quit the app and reopen. CTA card should stay dismissed.

5. **Tap-to-scroll** — tap the Bar Harbor pill while scrolled to top. Should animate to the Bar Harbor section.

- [ ] **Tag and commit if all passes**

```bash
git tag v0.3.0-sprint2a
git push origin feat/jernie-tab-sprint2a
git push origin --tags
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ §3 Hero collapse: `HeroLayer.tsx` Task 2 — height interpolation, expanded/compact opacity, `scrollY` SharedValue
- ✅ §4 Accordion animation: `ItineraryDayRow.tsx` Task 1 — `withSpring` height + chevron rotation
- ✅ §5 Scroll-position stop tracking: `jernie.tsx` Task 2 — `updateVisibleStop` + `runOnJS`
- ✅ §6 MMKV CTA persist: `jernie.tsx` Task 2 — `uiStorage.getBoolean`/`uiStorage.set`
- ✅ §7 RestaurantBooking: `types.ts` Task 0
- ✅ §7 `bookingsByStop` useMemo: `jernie.tsx` Task 2
- ✅ §7 `useCallback` callbacks: `jernie.tsx` Task 2 — `handleStopPress`, `handleDayPress`, `handleSectionLayout`
- ✅ `chevronOpen` static style removed: Task 1
- ✅ `useAnimatedRef` replaces `useRef<ScrollView>`: Task 2
- ✅ `scrollTo(scrollRef, ...)` Reanimated pattern: Task 2

**Type consistency:** `SharedValue<number>` imported from `react-native-reanimated` in HeroLayer matches the type produced by `useSharedValue(0)` in jernie.tsx. `Animated.ScrollView` used consistently in `useAnimatedRef` generic and the JSX element type.
