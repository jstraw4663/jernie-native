# Jernie Tab — Sprint 2a: Animations & UX Polish

> Written: May 30, 2026
> Status: **Design complete — ready for implementation plan**
> Author: Jeremy (with Claude)
> Parent spec: `~/jernie/docs/superpowers/specs/2026-05-29-jernie-native-migration-design.md`
> Sprint 1 spec: `~/jernie/docs/superpowers/specs/2026-05-30-jernie-tab-sprint1-design.md`
> Branch: `feat/jernie-tab-sprint2a` (cut from `dev`)

---

## 1. Scope & Goals

Add Reanimated animations, scroll-driven interactivity, and small cleanup items to the Jernie tab. Still uses fixture data throughout — RTDB hooks are Sprint 2b.

**In scope:**
- Hero collapse: 280px → 120px scroll-driven, cross-fade between expanded and compact layouts
- Accordion height animation: spring-driven height interpolation with chevron rotation
- Scroll-position stop tracking: `visibleStopId` updates as user scrolls through stop sections
- MMKV CTA dismiss persistence: survives app restarts
- `RestaurantBooking` type added to `src/types.ts`
- `bookingsForStop` → `useMemo`; inline `.map()` callbacks → `useCallback`

**Out of scope (Sprint 2b):**
- RTDB hooks, TripContext, trip shell wiring
- Drag reorder
- CTA card carousel / page dots
- Phase-aware smart nudge cards
- Weather / live flight status

---

## 2. Data Architecture Note

Sprint 2a intentionally defers Firebase integration. The data layer decision (Option B: `get()` + MMKV cache for content, `onValue` for user state) is locked for Sprint 2b. See GitHub issue #1 for the longer-term Option C (Firestore for content).

---

## 3. Hero Collapse Animation

### Props change

`HeroLayer` gains one new prop:

```typescript
interface HeroLayerProps {
  trip: Trip;
  activeStop: Stop;        // date-based active stop — drives phase pill
  visibleStop: Stop;       // scroll-position stop — drives compact strip city/emoji
  scrollY: SharedValue<number>;
}
```

### ScrollView → Animated.ScrollView

In `jernie.tsx`:

```typescript
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedRef,
  runOnJS,
} from 'react-native-reanimated';

// Replace useRef<ScrollView> with:
const scrollRef = useAnimatedRef<Animated.ScrollView>();
const scrollY = useSharedValue(0);

const scrollHandler = useAnimatedScrollHandler({
  onScroll: (event) => {
    scrollY.value = event.contentOffset.y;
    runOnJS(updateVisibleStop)(event.contentOffset.y);
  },
});

// Replace <ScrollView ref={scrollRef}> with:
<Animated.ScrollView
  ref={scrollRef}
  onScroll={scrollHandler}
  scrollEventThrottle={16}
  ...rest
>
```

`scrollRef.current?.scrollTo({ y: offset, animated: true })` continues to work unchanged.
`stickyHeaderIndices` and all other props are unchanged.

### Animated styles inside HeroLayer

Three `useAnimatedStyle` calls, all driven by the `scrollY` shared value passed as prop:

```typescript
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

// 1. Hero container height
const heroStyle = useAnimatedStyle(() => ({
  height: interpolate(
    scrollY.value,
    [0, 120],
    [280, 120],
    Extrapolation.CLAMP,
  ),
}));

// 2. Expanded content (trip pill row + large city name + subtitle)
const expandedStyle = useAnimatedStyle(() => ({
  opacity: interpolate(
    scrollY.value,
    [0, 80],
    [1, 0],
    Extrapolation.CLAMP,
  ),
}));

// 3. Compact strip (absolutely positioned, bottom of hero)
const compactStyle = useAnimatedStyle(() => ({
  opacity: interpolate(
    scrollY.value,
    [80, 120],
    [0, 1],
    Extrapolation.CLAMP,
  ),
}));
```

### Layout structure

```
<Animated.View style={[styles.hero, heroStyle]}>         ← height animates
  <LinearGradient style={StyleSheet.absoluteFill} ... />  ← fills parent

  {/* Expanded content — fades out */}
  <Animated.View style={[styles.expandedContent, expandedStyle]}>
    <View style={styles.pillRow}>
      <TripPill />
      <PhasePill />
    </View>
    <View style={styles.bottom}>
      <Text style={styles.city}>{activeStop.city}</Text>
      <Text style={styles.subtitle}>...</Text>
    </View>
  </Animated.View>

  {/* Compact strip — fades in, always at bottom */}
  <Animated.View style={[styles.compactStrip, compactStyle]}>
    <Text style={styles.compactCity}>
      {visibleStop.emoji}  {visibleStop.city}
    </Text>
    <PhasePill />   {/* reused, same component */}
  </Animated.View>
</Animated.View>
```

`compactStrip` style: `position: 'absolute'`, `bottom: Spacing.xl`, `left: Spacing.base`, `right: Spacing.base`, `flexDirection: 'row'`, `alignItems: 'center'`, `justifyContent: 'space-between'`.

`compactCity` style: `Typography.roles.h3`, `color: '#FFFFFF'`.

`borderBottomLeftRadius` and `borderBottomRightRadius` stay fixed at `Radius.hero` — no radius animation.

`marginBottom: -4` stays unchanged.

---

## 4. Accordion Height Animation

All changes are internal to `ItineraryDayRow` — props and parent logic are unchanged.

### Height calculation

```typescript
const ITEM_ROW_HEIGHT = 44;
const ITEM_LIST_BOTTOM_PAD = Spacing.sm; // 8px

const contentHeight = day.items.length * ITEM_ROW_HEIGHT + ITEM_LIST_BOTTOM_PAD;
```

### Animated height + chevron

```typescript
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

const animatedHeight = useSharedValue(0);
const chevronProgress = useSharedValue(0);

useEffect(() => {
  const target = isExpanded ? contentHeight : 0;
  animatedHeight.value = withSpring(target, { stiffness: 380, damping: 35 });
  chevronProgress.value = withSpring(isExpanded ? 1 : 0, { stiffness: 380, damping: 35 });
}, [isExpanded, contentHeight]);

const itemListStyle = useAnimatedStyle(() => ({
  height: animatedHeight.value,
  overflow: 'hidden',
}));

const chevronStyle = useAnimatedStyle(() => ({
  transform: [{
    rotate: interpolate(chevronProgress.value, [0, 1], [0, 90], Extrapolation.CLAMP) + 'deg',
  }],
}));
```

### Render change

Item list changes from conditional render to always-rendered animated container:

```typescript
// Before:
{isExpanded && (
  <View style={styles.itemList}>...</View>
)}

// After:
<Animated.View style={itemListStyle}>
  <View style={styles.itemList}>...</View>
</Animated.View>
```

Chevron `<Text>` wraps in `<Animated.View style={chevronStyle}>`. The static `chevronOpen` style (with `transform: rotate 90deg`) is removed — rotation is now fully Reanimated-driven.

---

## 5. Scroll-Position Stop Tracking

### State and constant

In `jernie.tsx`:

```typescript
const STICKY_HEADER_HEIGHT = 130; // approx CTA (when present) + StopsStrip height

const [visibleStopId, setVisibleStopId] = useState<string>(
  activeStopId ?? DEV_STOPS[0].id
);
const visibleStop = DEV_STOPS.find(s => s.id === visibleStopId) ?? DEV_STOPS[0];
```

### updateVisibleStop (JS thread function)

```typescript
function updateVisibleStop(y: number) {
  const offsets = sectionOffsets.current;
  let newId = DEV_STOPS[0].id;
  for (const stop of DEV_STOPS) {
    const offset = offsets[stop.id];
    if (offset !== undefined && y >= offset - STICKY_HEADER_HEIGHT) {
      newId = stop.id;
    }
  }
  setVisibleStopId(prev => prev === newId ? prev : newId);
}
```

The early-exit `prev === newId` guard prevents unnecessary re-renders on every scroll event.

### Prop updates

- `StopsStrip` receives `activeStopId={visibleStopId}` (replaces date-based `activeStopId`)
- `HeroLayer` receives `visibleStop={visibleStop}` (new prop)
- Date-based `activeStopId` is kept in scope for phase pill label and `visibleStopId` initial value

---

## 6. MMKV CTA Dismiss Persistence

```typescript
import { createMMKV } from 'react-native-mmkv';
const uiStorage = createMMKV({ id: 'jernie-ui' });

// In JernieTab:
const ctaKey = `cta_dismissed_${DEV_TRIP.id}`;
const [ctaDismissed, setCtaDismissed] = useState(
  () => uiStorage.getBoolean(ctaKey) ?? false
);

function handleDismissCTA() {
  uiStorage.set(ctaKey, true);
  setCtaDismissed(true);
}
```

`DEV_TRIP.id` is replaced with real `tripId` in Sprint 2b when context is wired.

---

## 7. Type & Performance Cleanup

### RestaurantBooking

Add to `src/types.ts` after `RentalBooking`:

```typescript
export interface RestaurantBooking {
  id: string;
  tripId: string;
  stopId: string;
  type: 'restaurant';
  restaurantName: string;
  date: string;          // YYYY-MM-DD
  time?: string;         // "7:30 PM"
  partySize?: number;
  confirmationCode?: string;
}

export type Booking = FlightBooking | HotelBooking | RentalBooking | RestaurantBooking;
```

### useMemo for bookingsForStop

```typescript
const bookingsByStop = useMemo(
  () => Object.fromEntries(
    DEV_STOPS.map(s => [s.id, DEV_BOOKINGS.filter(b => b.stopId === s.id)])
  ),
  [] // fixture data never changes; real deps added in Sprint 2b
);
// Usage: bookingsByStop[stop.id]
```

### useCallback for map callbacks

Stabilize to two-arg functions. The inline arrow wrapper in `.map()` still exists, but it wraps a stable reference rather than recreating the underlying logic each render.

```typescript
const handleDayPress = useCallback(
  (stopId: string, dayId: string | null) => setExpandedDayId(stopId, dayId),
  [] // setExpandedDayId from useState updater is stable
);

const handleSectionLayout = useCallback(
  (stopId: string, y: number) => { sectionOffsets.current[stopId] = y; },
  []
);

// Usage in map:
onDayPress={dayId => handleDayPress(stop.id, dayId)}
onSectionLayout={y => handleSectionLayout(stop.id, y)}
```

---

## 8. Tests

No new test suites required — animation logic is UI-only (not pure functions). Existing 42 tests must continue to pass.

TypeScript must compile cleanly with `RestaurantBooking` added to the `Booking` union. `TravelCard.tsx`'s `BOOKING_TYPE_COLOR` already has `restaurant: TypeColors.food` at the string level — adding `RestaurantBooking` to the union closes the type gap without any color change needed.

---

## 9. Sprint 2b Upgrade Path

| Sprint 2b addition | Where it hooks in |
|---|---|
| `useTripData` + `useTripUserState` hooks | New files in `src/hooks/` |
| `TripContext` | New `src/contexts/TripContext.tsx` |
| Trip shell wiring | `app/(trips)/[tripId]/_layout.tsx` |
| `jernie.tsx` fixture swap | Replace `DEV_*` imports with `useTripContext()` |
| Real `tripId` for MMKV CTA key | Replace `DEV_TRIP.id` with context tripId |
| `bookingsByStop` deps | Add context bookings to `useMemo` dep array |
