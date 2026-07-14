# Entity Detail Sheets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build scrollable bottom-sheet detail views for restaurant, hike, hotel, and flight entities, triggered by tapping TravelCards (hotel/flight) and ItineraryItem rows (restaurant/hike) in the Jernie tab.

**Architecture:** `BottomSheetModal` from `@gorhom/bottom-sheet` v5 (already installed) serves as the overlay shell with a backdrop dim and pan-to-dismiss. A shared `SheetHero` handles two visual modes (photo+chips for places, gradient+content for travel). Four entity content components share common sub-components (`SheetParts`). All enrichment data is hardcoded mock matching Firestore types — easy to swap later.

**Tech Stack:** `@gorhom/bottom-sheet` ^5.2.14, `react-native-gesture-handler` ~2.31.1, Reanimated v4, `expo-linear-gradient`, existing design tokens from `src/design/tokens.ts`.

## Global Constraints

- All colors/spacing/radius from `src/design/tokens.ts` — no hardcoded values except white-on-photo overlays
- `hexWithAlpha(hex, alpha)` from `src/utils/colors.ts` for stop-color alpha variants
- `BottomSheetModalProvider` must wrap the entire app (add to `app/_layout.tsx`)
- Snap point: `'95%'` — one snap point only
- `useSheetContext()` (`src/contexts/SheetContext.tsx`): call `increment()` on open, `decrement()` on dismiss
- No new npm dependencies
- `npm test` (npx jest) must pass after each task commit

---

## File Map

**New files:**

| Path | Responsibility |
|------|----------------|
| `src/features/jernie/sheets/types.ts` | `EntitySheetPayload` discriminated union |
| `src/features/jernie/sheets/mockEntityData.ts` | Hardcoded enrichment per entity type |
| `src/features/jernie/sheets/SheetHero.tsx` | 220px hero — place mode (photo+chips) or travel mode (gradient+content slot) |
| `src/features/jernie/sheets/SheetParts.tsx` | `InfoSection`, `PhotoStrip`, `ReviewRail`, `QuickActions`, `DistanceModule` |
| `src/features/jernie/sheets/FloatingCTA.tsx` | "Add to Stop" ↔ "In your itinerary" toggle |
| `src/features/jernie/sheets/RestaurantSheet.tsx` | Restaurant body (uses SheetParts + FloatingCTA) |
| `src/features/jernie/sheets/HikeSheet.tsx` | Hike body (stat grid + SheetParts + FloatingCTA) |
| `src/features/jernie/sheets/HotelSheet.tsx` | Hotel body (stay timeline, amenities) |
| `src/features/jernie/sheets/FlightSheet.tsx` | Flight body (dark block, status rows, after-landing) |
| `src/features/jernie/sheets/EntityDetailSheet.tsx` | `BottomSheetModal` shell — dispatches to entity content |

**Modified files:**

| Path | Change |
|------|--------|
| `app/_layout.tsx` | Add `BottomSheetModalProvider` inside `GestureHandlerRootView` |
| `src/features/jernie/components/TravelCard.tsx` | Add `onPress?: () => void`; wrap sub-cards in `TouchableOpacity` |
| `src/features/jernie/components/ItineraryDayRow.tsx` | Add `onItemPress?: (item: ItineraryItem) => void`; wrap item rows in `TouchableOpacity` |
| `src/features/jernie/StopSection.tsx` | Accept + thread `onBookingPress` and `onItemPress` |
| `app/(trips)/[tripId]/(tabs)/jernie.tsx` | Sheet ref, payload state, callbacks, render `EntityDetailSheet` |

---

## Task 1: Provider + types + mock data

**Files:**
- Modify: `app/_layout.tsx`
- Create: `src/features/jernie/sheets/types.ts`
- Create: `src/features/jernie/sheets/mockEntityData.ts`

**Produces:** `EntitySheetPayload` type + four mock constants used by all subsequent tasks.

- [ ] **Step 1: Add `BottomSheetModalProvider` to `app/_layout.tsx`**

```tsx
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

// Wrap inside GestureHandlerRootView, outside ConnectivityProvider:
<GestureHandlerRootView style={{ flex: 1 }}>
  <BottomSheetModalProvider>
    <ConnectivityProvider>
      <SheetProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </SheetProvider>
    </ConnectivityProvider>
  </BottomSheetModalProvider>
</GestureHandlerRootView>
```

- [ ] **Step 2: Create `src/features/jernie/sheets/types.ts`**

```typescript
import type { FlightBooking, HotelBooking } from '@/src/types';

export type EntitySheetPayload =
  | { kind: 'flight';     booking: FlightBooking; stopColor: string; stopLabel: string }
  | { kind: 'hotel';      booking: HotelBooking;  stopColor: string; stopLabel: string }
  | { kind: 'restaurant'; name: string; stopLabel: string; stopColor: string }
  | { kind: 'hike';       name: string; stopLabel: string; stopColor: string };
```

- [ ] **Step 3: Create `src/features/jernie/sheets/mockEntityData.ts`**

```typescript
// Mirrors PlaceEnrichment shape from src/types.ts
export const MOCK_RESTAURANT = {
  rating: 4.6,
  ratingCount: 847,
  price: 2,
  phone: '(207) 288-2822',
  website: 'havanarestaurant.com',
  address: '318 Main St, Bar Harbor, ME',
  openNow: true,
  closesAt: '9:30 PM',
  curatorNote: 'Latin-influenced coastal cuisine near the village green. The Caribbean lobster dish is a local staple.',
  guideNote: 'Book 10+ days ahead for weekend tables. Request the courtyard if weather looks good.',
  headsUp: 'No walk-ins for dinner July–August.',
  heroPhoto: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=800&q=80',
  photos: [
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=400&q=75',
    'https://images.unsplash.com/photo-1544025162-d76538d04b8a?auto=format&fit=crop&w=400&q=75',
    'https://images.unsplash.com/photo-1481833761820-0509d3217039?auto=format&fit=crop&w=400&q=75',
    'https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=400&q=75',
  ],
  reviews: [
    { author: 'Meg L.',    rating: 5, text: 'Incredible meal. The ropa vieja was perfectly spiced and the rum cocktails were dangerous. Book ahead — this fills up fast.', time: Date.now() - 1_814_400_000 },
    { author: 'Thomas R.', rating: 4, text: 'Great atmosphere and killer cocktails. Service was a bit slow on a Friday night but the food absolutely made up for it.', time: Date.now() - 2_592_000_000 },
    { author: 'Sarah K.',  rating: 5, text: 'Best dinner of the whole Maine trip. The courtyard is magical when the weather cooperates.', time: Date.now() - 5_184_000_000 },
  ],
  distanceLabel: 'From Jordan Pond trailhead',
  distanceValue: '8.4 mi',
} as const;

// Mirrors TrailEnrichment shape from src/types.ts
export const MOCK_HIKE = {
  distance: 3.4,
  elevationGain: 180,
  difficulty: 'Easy',
  routeType: 'Loop',
  dogFriendly: true,
  curatorNote: 'The crown jewel loop of Acadia — flat 3.4-mile trail around Jordan Pond with dramatic views of The Bubbles.',
  guideNote: 'Parking fills by 10:30 AM in peak season. Take the Island Explorer bus from downtown Bar Harbor (free, runs seasonally).',
  headsUp: 'Popover lunch often has a wait; arrive before noon.',
  address: 'Jordan Pond Rd, Seal Harbor, ME',
  heroPhoto: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Acadia_National_Park_02.JPG/1280px-Acadia_National_Park_02.JPG',
  photos: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Acadia_National_Park_02.JPG/1280px-Acadia_National_Park_02.JPG',
    'https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=400&q=75',
    'https://images.unsplash.com/photo-1533240332313-0db49b459ad6?auto=format&fit=crop&w=400&q=75',
  ],
  distanceLabel: 'From Bar Harbor Grand Hotel',
  distanceValue: '8.7 mi · 22 min',
} as const;

// Mirrors HotelEnrichment shape from src/types.ts
export const MOCK_HOTEL = {
  rating: 4.5,
  ratingCount: 1240,
  phone: '(207) 288-5226',
  website: 'barharborgrand.com',
  address: '269 Main St, Bar Harbor, ME',
  amenities: ['Pool', 'Fitness', 'Free Parking', 'Pet-Friendly', 'Breakfast', 'Concierge'],
  heroPhoto: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=800&q=80',
  distanceLabel: 'From Jordan Pond trailhead',
  distanceValue: '8.7 mi',
} as const;

// Mirrors FlightStatus shape from src/types.ts
export const MOCK_FLIGHT = {
  status: 'on_time' as 'on_time' | 'delayed' | 'cancelled' | 'landed' | 'unknown',
  gate_origin: 'B14',
  terminal_origin: 'B',
  terminal_destination: '1',
  aircraft_type: 'B737-700',
  delay_minutes: 0,
  leaveByLabel: 'By 7:10 AM · allow 90 min',
  afterLanding: {
    rentalLabel: 'Enterprise · Bangor Airport · Compact SUV',
    driveLabel: '42 min · 47 miles · arrive ~11:40 AM',
    distanceLabel: 'Bangor Airport to Bar Harbor Grand',
    distanceValue: '47 mi · 42 min',
  },
} as const;
```

- [ ] **Step 4: Run `npx jest`** — expect all tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/_layout.tsx src/features/jernie/sheets/
git commit -m "feat: add BottomSheetModalProvider, entity sheet types, and mock enrichment data"
```

---

## Task 2: `SheetParts.tsx` — shared sub-components

**Files:**
- Create: `src/features/jernie/sheets/SheetParts.tsx`

**Produces:** `InfoSection`, `PhotoStrip`, `ReviewRail`, `QuickActions`, `DistanceModule` named exports.

- [ ] **Step 1: Create `src/features/jernie/sheets/SheetParts.tsx`**

```tsx
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Core, Semantic, Typography, Spacing, Radius, Brand } from '@/src/design/tokens';

// ── InfoSection ───────────────────────────────────────────────────────────────

interface InfoRowDef { label: string; value: string; variant?: 'default' | 'link' | 'warning' }

export function InfoSection({ title, rows }: { title: string; rows: InfoRowDef[] }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {rows.map((row, i) => (
        <View key={i} style={[s.infoRow, i === rows.length - 1 && s.infoRowLast]}>
          <Text style={s.rowLabel}>{row.label}</Text>
          <Text style={[
            s.rowValue,
            row.variant === 'link'    && s.rowLink,
            row.variant === 'warning' && s.rowWarning,
          ]}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

// ── PhotoStrip ────────────────────────────────────────────────────────────────

export function PhotoStrip({ photos }: { photos: readonly string[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.photoStrip}>
      {photos.map((uri, i) => (
        <Image key={i} source={{ uri }} style={s.photoThumb} />
      ))}
    </ScrollView>
  );
}

// ── ReviewRail ────────────────────────────────────────────────────────────────

interface ReviewDef { author: string; rating: number; text: string; time: number }

const AVATAR_BG = [Core.action, Brand.navySoft, Semantic.error];

export function ReviewRail({ reviews, stopColor }: { reviews: readonly ReviewDef[]; stopColor: string }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.reviewRail}>
      {reviews.map((r, i) => (
        <View key={i} style={s.reviewCard}>
          <View style={s.reviewTop}>
            <View style={[s.reviewAvatar, { backgroundColor: AVATAR_BG[i % AVATAR_BG.length] }]}>
              <Text style={s.reviewAvatarText}>{r.author[0]}</Text>
            </View>
            <View>
              <Text style={s.reviewName}>{r.author}</Text>
              <Text style={s.reviewDate}>{timeAgo(r.time)}</Text>
            </View>
          </View>
          <Text style={s.reviewStars}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</Text>
          <Text style={s.reviewText}>{r.text}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function timeAgo(ms: number): string {
  const d = Math.floor((Date.now() - ms) / 86_400_000);
  if (d < 7)   return `${d} day${d !== 1 ? 's' : ''} ago`;
  if (d < 30)  return `${Math.floor(d / 7)} week${Math.floor(d / 7) !== 1 ? 's' : ''} ago`;
  return `${Math.floor(d / 30)} month${Math.floor(d / 30) !== 1 ? 's' : ''} ago`;
}

// ── QuickActions ──────────────────────────────────────────────────────────────

export function QuickActions({ actions, stopColor }: { actions: readonly string[]; stopColor: string }) {
  return (
    <View style={s.quickActions}>
      {actions.map((label, i) => (
        <TouchableOpacity
          key={i}
          style={[s.qaBtn, { backgroundColor: stopColor + '18', borderColor: stopColor + '30' }]}
          activeOpacity={0.7}
        >
          <Text style={[s.qaBtnText, { color: stopColor }]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── DistanceModule ────────────────────────────────────────────────────────────

export function DistanceModule({ label, value, stopColor }: { label: string; value: string; stopColor: string }) {
  return (
    <View style={s.distMod}>
      <Text style={s.distLabel}>{label}</Text>
      <Text style={[s.distValue, { color: stopColor }]}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  section:       { paddingHorizontal: Spacing.base, paddingTop: Spacing.md, paddingBottom: Spacing.xs },
  sectionTitle:  { fontSize: 11, fontFamily: 'DMSans', fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase', color: Core.textFaint, marginBottom: Spacing.sm },
  infoRow:       { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Core.border },
  infoRowLast:   { borderBottomWidth: 0 },
  rowLabel:      { width: 90, fontSize: 12, fontFamily: 'DMSans', fontWeight: '600', color: Core.textMuted, paddingTop: 1 },
  rowValue:      { flex: 1, fontSize: 13, fontFamily: 'DMSans', color: Core.text, lineHeight: 18 },
  rowLink:       { color: Core.action },
  rowWarning:    { color: Semantic.warning, fontWeight: '600' as const },
  photoStrip:    { paddingHorizontal: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.md },
  photoThumb:    { width: 148, height: 96, borderRadius: Radius.lg },
  reviewRail:    { paddingHorizontal: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.md },
  reviewCard:    { width: 248, backgroundColor: Core.surface, borderWidth: 1, borderColor: Core.border, borderRadius: Radius.xl, padding: Spacing.md },
  reviewTop:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  reviewAvatar:  { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  reviewAvatarText: { fontSize: 14, fontWeight: '700' as const, color: Core.white, fontFamily: 'DMSans' },
  reviewName:    { fontSize: 12, fontWeight: '700' as const, fontFamily: 'DMSans', color: Core.text },
  reviewDate:    { fontSize: 10, color: Core.textFaint, fontFamily: 'DMSans', marginTop: 1 },
  reviewStars:   { fontSize: 11, color: '#C89A2B', marginBottom: 7 },
  reviewText:    { fontSize: 12, fontFamily: 'DMSans', color: Core.textMuted, lineHeight: 17 },
  quickActions:  { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Core.border },
  qaBtn:         { height: 36, paddingHorizontal: Spacing.md, borderRadius: Radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  qaBtnText:     { fontSize: 12, fontWeight: '700' as const, fontFamily: 'DMSans' },
  distMod:       { backgroundColor: Core.surfaceMuted, borderRadius: Radius.md, padding: 10, marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: Core.border },
  distLabel:     { fontSize: 12, fontFamily: 'DMSans', color: Core.textMuted },
  distValue:     { fontSize: 13, fontWeight: '700' as const, fontFamily: 'DMSans' },
});
```

- [ ] **Step 2: `npx jest`** — expect pass.

- [ ] **Step 3: Commit**

```bash
git add src/features/jernie/sheets/SheetParts.tsx
git commit -m "feat: add shared SheetParts sub-components"
```

---

## Task 3: `SheetHero` + `FloatingCTA`

**Files:**
- Create: `src/features/jernie/sheets/SheetHero.tsx`
- Create: `src/features/jernie/sheets/FloatingCTA.tsx`

- [ ] **Step 1: Create `src/features/jernie/sheets/SheetHero.tsx`**

```tsx
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Core, Brand, Spacing, Radius } from '@/src/design/tokens';
import { stopHeroGradient, hexWithAlpha } from '@/src/utils/colors';

type PlaceMode = {
  mode: 'place';
  photoUri: string;
  emoji: string;
  categoryLabel: string;
  stopLabel: string;
  stopColor: string;
};

type TravelMode = {
  mode: 'travel';
  photoUri?: string;  // absent → gradient background
  stopColor: string;
  children: React.ReactNode;
};

type SheetHeroProps = (PlaceMode | TravelMode) & { onClose: () => void };

export function SheetHero(props: SheetHeroProps) {
  const gradientColors = stopHeroGradient(props.stopColor);

  return (
    <View style={s.hero}>
      {(props.mode === 'place' || props.photoUri) ? (
        <Image
          source={{ uri: props.mode === 'place' ? props.photoUri : (props as TravelMode).photoUri! }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={[Brand.navy, gradientColors[1]]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      <LinearGradient
        colors={['rgba(7,13,24,0.12)', 'rgba(7,13,24,0.40)', 'rgba(7,13,24,0.84)']}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />

      <TouchableOpacity style={s.closeBtn} onPress={props.onClose} activeOpacity={0.8}>
        <Text style={s.closeTxt}>✕</Text>
      </TouchableOpacity>

      {props.mode === 'place' ? (
        <View style={s.heroBottom}>
          <View style={s.heroEmoji}>
            <Text style={s.heroEmojiTxt}>{props.emoji}</Text>
          </View>
          <View style={s.heroChips}>
            <View style={s.catChip}>
              <Text style={s.catChipTxt}>{props.categoryLabel}</Text>
            </View>
            <View style={[s.stopChip, { backgroundColor: hexWithAlpha(props.stopColor, 0.30), borderColor: hexWithAlpha(props.stopColor, 0.55) }]}>
              <Text style={s.stopChipTxt}>{props.stopLabel}</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={s.heroTravel}>{props.children}</View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  hero:        { height: 220, overflow: 'hidden', backgroundColor: Brand.navy },
  closeBtn:    { position: 'absolute', top: 14, right: 14, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.32)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  closeTxt:    { fontSize: 14, fontWeight: '600' as const, color: Core.white, fontFamily: 'DMSans' },
  heroBottom:  { position: 'absolute', left: Spacing.base, right: Spacing.base, bottom: Spacing.base, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', zIndex: 2 },
  heroEmoji:   { width: 52, height: 52, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroEmojiTxt:{ fontSize: 28 },
  heroChips:   { alignItems: 'flex-end', gap: 5 },
  catChip:     { height: 24, paddingHorizontal: 10, borderRadius: Radius.full, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  catChipTxt:  { fontSize: 11, fontWeight: '700' as const, color: 'rgba(255,255,255,0.9)', fontFamily: 'DMSans' },
  stopChip:    { height: 22, paddingHorizontal: 9, borderRadius: Radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stopChipTxt: { fontSize: 10, fontWeight: '700' as const, color: Core.white, fontFamily: 'DMSans' },
  heroTravel:  { position: 'absolute', left: Spacing.base, right: Spacing.base, bottom: Spacing.base, zIndex: 2 },
});
```

- [ ] **Step 2: Create `src/features/jernie/sheets/FloatingCTA.tsx`**

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Core, Semantic, Spacing, Radius } from '@/src/design/tokens';

interface FloatingCTAProps {
  stopLabel: string;
  stopColor: string;
  isAdded: boolean;
  onAdd: () => void;
  onView: () => void;
}

export function FloatingCTA({ stopLabel, stopColor, isAdded, onAdd, onView }: FloatingCTAProps) {
  return (
    <View style={s.container}>
      {!isAdded ? (
        <TouchableOpacity style={[s.addBtn, { backgroundColor: stopColor }]} onPress={onAdd} activeOpacity={0.85}>
          <Text style={s.addPlus}>+</Text>
          <Text style={s.addTxt}>Add to {stopLabel}</Text>
        </TouchableOpacity>
      ) : (
        <View style={s.addedPill}>
          <View style={[s.addedCheck, { backgroundColor: Semantic.confirmed }]}>
            <Text style={s.addedCheckTxt}>✓</Text>
          </View>
          <View style={s.addedBody}>
            <Text style={s.addedTitle}>In your itinerary</Text>
            <Text style={s.addedStop}>{stopLabel}</Text>
          </View>
          <TouchableOpacity style={s.viewBtn} onPress={onView} activeOpacity={0.75}>
            <Text style={s.viewBtnTxt}>View</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:     { paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, paddingBottom: Spacing.lg, backgroundColor: Core.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Core.border },
  addBtn:        { borderRadius: Radius.lg, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  addPlus:       { fontSize: 20, color: Core.white, lineHeight: 24, fontFamily: 'DMSans' },
  addTxt:        { fontSize: 15, fontWeight: '600' as const, color: Core.white, fontFamily: 'DMSans' },
  addedPill:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Semantic.confirmedTint, borderWidth: 0.5, borderColor: 'rgba(200,154,43,0.4)', borderRadius: Radius.lg, padding: Spacing.sm },
  addedCheck:    { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  addedCheckTxt: { fontSize: 16, color: Core.white },
  addedBody:     { flex: 1 },
  addedTitle:    { fontSize: 13, fontWeight: '700' as const, color: Semantic.confirmedDark, fontFamily: 'DMSans' },
  addedStop:     { fontSize: 12, color: Semantic.confirmedDark, fontFamily: 'DMSans', opacity: 0.8 },
  viewBtn:       { paddingVertical: 7, paddingHorizontal: 13, borderRadius: Radius.full, borderWidth: 0.5, borderColor: 'rgba(200,154,43,0.55)' },
  viewBtnTxt:    { fontSize: 11, fontWeight: '600' as const, color: Semantic.confirmedDark, fontFamily: 'DMSans' },
});
```

- [ ] **Step 3: `npx jest`** — expect pass.

- [ ] **Step 4: Commit**

```bash
git add src/features/jernie/sheets/SheetHero.tsx src/features/jernie/sheets/FloatingCTA.tsx
git commit -m "feat: add SheetHero and FloatingCTA components"
```

---

## Task 4: `RestaurantSheet` + `HikeSheet`

**Files:**
- Create: `src/features/jernie/sheets/RestaurantSheet.tsx`
- Create: `src/features/jernie/sheets/HikeSheet.tsx`

Both use `SheetHero` in place mode and include `FloatingCTA`. Root element is `View style={{ flex: 1 }}` containing `BottomSheetScrollView` + `FloatingCTA`.

- [ ] **Step 1: Create `src/features/jernie/sheets/RestaurantSheet.tsx`**

```tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SheetHero } from './SheetHero';
import { InfoSection, PhotoStrip, ReviewRail, QuickActions, DistanceModule } from './SheetParts';
import { FloatingCTA } from './FloatingCTA';
import { MOCK_RESTAURANT } from './mockEntityData';
import { Core, Semantic, Typography, Spacing } from '@/src/design/tokens';

interface RestaurantSheetProps {
  name: string;
  stopLabel: string;
  stopColor: string;
  onClose: () => void;
}

export function RestaurantSheet({ name, stopLabel, stopColor, onClose }: RestaurantSheetProps) {
  const [added, setAdded] = useState(false);
  const m = MOCK_RESTAURANT;
  const priceLabel = ['', '$', '$$', '$$$'][m.price] ?? '';

  return (
    <View style={s.root}>
      <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <SheetHero
          mode="place"
          photoUri={m.heroPhoto}
          emoji="🍽️"
          categoryLabel="🍽 Restaurant"
          stopLabel={stopLabel}
          stopColor={stopColor}
          onClose={onClose}
        />

        <View style={s.titleRow}>
          <View style={s.titleLeft}>
            <Text style={s.name}>{name}</Text>
            <Text style={s.subtitle}>{stopLabel} · Latin-Caribbean cuisine</Text>
          </View>
          <View style={s.ratingCol}>
            <Text style={s.stars}>★ {m.rating}</Text>
            <Text style={s.ratingCount}>({m.ratingCount.toLocaleString()})</Text>
            <Text style={s.price}>{priceLabel}</Text>
          </View>
        </View>

        <QuickActions actions={['📞 Call', '🌐 Website', '📍 Navigate']} stopColor={stopColor} />

        <View style={s.hoursRow}>
          <Text style={s.openNow}>Open now</Text>
          <Text style={s.hoursText}> · closes {m.closesAt}</Text>
        </View>

        <InfoSection title="Info" rows={[
          { label: 'About',   value: m.curatorNote },
          { label: 'Curated', value: '⭐ Must-visit pick' },
        ]} />
        <InfoSection title="Notes" rows={[
          { label: 'Guide notes', value: m.guideNote },
          { label: 'Heads up',    value: `⚠ ${m.headsUp}`, variant: 'warning' },
        ]} />

        <Text style={s.photoLabel}>Photos</Text>
        <PhotoStrip photos={m.photos} />

        <Text style={s.photoLabel}>Reviews</Text>
        <ReviewRail reviews={m.reviews} stopColor={stopColor} />

        <InfoSection title="Contact & Location" rows={[
          { label: 'Phone',   value: m.phone,   variant: 'link' },
          { label: 'Address', value: m.address, variant: 'link' },
          { label: 'Website', value: 'Open website', variant: 'link' },
        ]} />
        <View style={s.distPad}>
          <DistanceModule label={m.distanceLabel} value={m.distanceValue} stopColor={stopColor} />
        </View>
        <View style={s.bottomPad} />
      </BottomSheetScrollView>

      <FloatingCTA
        stopLabel={stopLabel}
        stopColor={stopColor}
        isAdded={added}
        onAdd={() => setAdded(true)}
        onView={() => {}}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1 },
  scroll:     { flexGrow: 1 },
  titleRow:   { padding: Spacing.base, paddingBottom: Spacing.sm, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  titleLeft:  { flex: 1 },
  name:       { fontFamily: 'Fraunces', fontSize: 26, color: Core.text, marginBottom: 3, lineHeight: 30 },
  subtitle:   { ...Typography.roles.meta, color: Core.textMuted, lineHeight: 18 },
  ratingCol:  { alignItems: 'flex-end', gap: 3, flexShrink: 0 },
  stars:      { fontSize: 13, color: '#C89A2B', fontWeight: '700' as const, fontFamily: 'DMSans' },
  ratingCount:{ fontSize: 11, color: Core.textFaint, fontFamily: 'DMSans' },
  price:      { fontSize: 12, color: Core.textMuted, fontFamily: 'DMSans', fontWeight: '500' as const },
  hoursRow:   { flexDirection: 'row', paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Core.border },
  openNow:    { fontSize: 13, fontFamily: 'DMSans', fontWeight: '700' as const, color: Semantic.success },
  hoursText:  { fontSize: 13, fontFamily: 'DMSans', color: Core.textMuted },
  photoLabel: { fontSize: 11, fontFamily: 'DMSans', fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase', color: Core.textFaint, paddingHorizontal: Spacing.base, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  distPad:    { paddingHorizontal: Spacing.base },
  bottomPad:  { height: 16 },
});
```

- [ ] **Step 2: Create `src/features/jernie/sheets/HikeSheet.tsx`**

```tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SheetHero } from './SheetHero';
import { InfoSection, PhotoStrip, DistanceModule } from './SheetParts';
import { FloatingCTA } from './FloatingCTA';
import { MOCK_HIKE } from './mockEntityData';
import { Core, Typography, Spacing, Radius } from '@/src/design/tokens';

interface HikeSheetProps {
  name: string;
  stopLabel: string;
  stopColor: string;
  onClose: () => void;
}

export function HikeSheet({ name, stopLabel, stopColor, onClose }: HikeSheetProps) {
  const [added, setAdded] = useState(false);
  const m = MOCK_HIKE;

  return (
    <View style={s.root}>
      <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <SheetHero
          mode="place"
          photoUri={m.heroPhoto}
          emoji="🥾"
          categoryLabel="🥾 Hike"
          stopLabel={stopLabel}
          stopColor={stopColor}
          onClose={onClose}
        />

        <View style={s.titleRow}>
          <View style={s.titleLeft}>
            <Text style={s.name}>{name}</Text>
            <Text style={s.subtitle}>{stopLabel} · Loop trail in Acadia</Text>
          </View>
          <View style={s.ratingCol}>
            <Text style={s.stars}>★ 4.8</Text>
            <Text style={s.ratingCount}>(2,340)</Text>
          </View>
        </View>

        <View style={s.statsGrid}>
          <StatCard value={`${m.distance}`} label="Miles"      color={stopColor} />
          <StatCard value={`${m.elevationGain}`} label="Ft gain"   color={stopColor} />
          <StatCard value={m.difficulty}    label="Difficulty" color={stopColor} />
        </View>

        <InfoSection title="Info" rows={[
          { label: 'About',      value: m.curatorNote },
          { label: 'Route type', value: m.routeType },
          { label: 'Dogs',       value: m.dogFriendly ? 'Allowed on leash' : 'Not allowed' },
          { label: 'Curated',    value: '⭐ Must-do in Acadia' },
        ]} />
        <InfoSection title="Notes" rows={[
          { label: 'Guide notes', value: m.guideNote },
          { label: 'Heads up',    value: `⚠ ${m.headsUp}`, variant: 'warning' },
        ]} />

        <Text style={s.photoLabel}>Photos</Text>
        <PhotoStrip photos={m.photos} />

        <InfoSection title="Contact & Location" rows={[
          { label: 'Address', value: m.address, variant: 'link' },
        ]} />
        <View style={s.distPad}>
          <DistanceModule label={m.distanceLabel} value={m.distanceValue} stopColor={stopColor} />
        </View>
        <View style={s.bottomPad} />
      </BottomSheetScrollView>

      <FloatingCTA
        stopLabel={stopLabel}
        stopColor={stopColor}
        isAdded={added}
        onAdd={() => setAdded(true)}
        onView={() => {}}
      />
    </View>
  );
}

function StatCard({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View style={s.statCard}>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1 },
  scroll:     { flexGrow: 1 },
  titleRow:   { padding: Spacing.base, paddingBottom: Spacing.sm, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  titleLeft:  { flex: 1 },
  name:       { fontFamily: 'Fraunces', fontSize: 26, color: Core.text, marginBottom: 3, lineHeight: 30 },
  subtitle:   { ...Typography.roles.meta, color: Core.textMuted, lineHeight: 18 },
  ratingCol:  { alignItems: 'flex-end', gap: 3, flexShrink: 0 },
  stars:      { fontSize: 13, color: '#C89A2B', fontWeight: '700' as const, fontFamily: 'DMSans' },
  ratingCount:{ fontSize: 11, color: Core.textFaint, fontFamily: 'DMSans' },
  statsGrid:  { flexDirection: 'row', paddingHorizontal: Spacing.base, gap: Spacing.sm, marginBottom: Spacing.md },
  statCard:   { flex: 1, backgroundColor: Core.surface, borderWidth: 1, borderColor: Core.border, borderRadius: Radius.lg, padding: 10, alignItems: 'center' },
  statValue:  { fontSize: 18, fontWeight: '800' as const, fontFamily: 'DMSans', letterSpacing: -0.5, marginBottom: 3 },
  statLabel:  { fontSize: 10, fontWeight: '700' as const, fontFamily: 'DMSans', color: Core.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' as const },
  photoLabel: { fontSize: 11, fontFamily: 'DMSans', fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase', color: Core.textFaint, paddingHorizontal: Spacing.base, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  distPad:    { paddingHorizontal: Spacing.base },
  bottomPad:  { height: 16 },
});
```

- [ ] **Step 3: `npx jest`** — expect pass.

- [ ] **Step 4: Commit**

```bash
git add src/features/jernie/sheets/RestaurantSheet.tsx src/features/jernie/sheets/HikeSheet.tsx
git commit -m "feat: add RestaurantSheet and HikeSheet content components"
```

---

## Task 5: `HotelSheet` + `FlightSheet`

**Files:**
- Create: `src/features/jernie/sheets/HotelSheet.tsx`
- Create: `src/features/jernie/sheets/FlightSheet.tsx`

Both use `SheetHero` in travel mode. No `FloatingCTA` (bookings are already confirmed). Root is `BottomSheetScrollView` directly.

- [ ] **Step 1: Create `src/features/jernie/sheets/HotelSheet.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SheetHero } from './SheetHero';
import { InfoSection, DistanceModule } from './SheetParts';
import { MOCK_HOTEL } from './mockEntityData';
import { Core, Typography, Spacing, Radius } from '@/src/design/tokens';
import { hexWithAlpha } from '@/src/utils/colors';
import type { HotelBooking } from '@/src/types';

interface HotelSheetProps {
  booking: HotelBooking;
  stopColor: string;
  stopLabel: string;
  onClose: () => void;
}

function shortDate(iso: string) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date(iso + 'T12:00:00');
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function nights(a: string, b: string) {
  return Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86_400_000);
}

const AMENITY_EMOJI: Record<string, string> = {
  Pool: '🏊', Fitness: '💪', 'Free Parking': '🅿️', 'Pet-Friendly': '🐾', Breakfast: '☕', Concierge: '🛎',
};

export function HotelSheet({ booking, stopColor, onClose }: HotelSheetProps) {
  const m = MOCK_HOTEL;
  const n = nights(booking.checkIn, booking.checkOut);

  return (
    <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
      <SheetHero mode="travel" photoUri={m.heroPhoto} stopColor={stopColor} onClose={onClose}>
        <View style={[s.badge, { backgroundColor: 'rgba(44,88,128,0.32)', borderColor: 'rgba(80,140,210,0.4)' }]}>
          <Text style={[s.badgeTxt, { color: '#c0dbff' }]}>Active Stay</Text>
        </View>
        <Text style={s.heroDates}>{shortDate(booking.checkIn)} → {shortDate(booking.checkOut)}</Text>
        <Text style={s.heroMeta}>{n} night{n !== 1 ? 's' : ''}{booking.roomType ? ` · ${booking.roomType}` : ''}</Text>
      </SheetHero>

      <View style={s.titleRow}>
        <View style={s.titleLeft}>
          <Text style={s.name}>{booking.hotelName}</Text>
          <Text style={s.subtitle}>Check-in {shortDate(booking.checkIn)} → {shortDate(booking.checkOut)}</Text>
        </View>
        <View style={s.ratingCol}>
          <Text style={s.stars}>★ {m.rating}</Text>
          <Text style={s.ratingCount}>({m.ratingCount.toLocaleString()})</Text>
        </View>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Your Stay</Text>
        <View style={[s.timeline, { borderColor: hexWithAlpha(stopColor, 0.18) }]}>
          <TRow icon="📅" color={stopColor} title={`Check-in: ${shortDate(booking.checkIn)} · 3:00 PM`} sub="Early check-in requested · awaiting confirmation" />
          {booking.roomType && (
            <TRow icon="🏷️" color={stopColor} title={booking.roomType} sub={booking.confirmationCode ? `Conf: ${booking.confirmationCode}` : 'Booked'} />
          )}
          <TRow icon="📅" color={stopColor} title={`Check-out: ${shortDate(booking.checkOut)} · 11:00 AM`} sub={`${n} night${n !== 1 ? 's' : ''} total`} last />
        </View>

        <Text style={[s.sectionTitle, { marginTop: 10 }]}>Amenities</Text>
        <View style={s.amenityRow}>
          {m.amenities.map(a => (
            <View key={a} style={s.amenity}>
              <Text style={s.amenityTxt}>{AMENITY_EMOJI[a] ?? '•'} {a}</Text>
            </View>
          ))}
        </View>
      </View>

      <InfoSection title="Contact & Location" rows={[
        { label: 'Phone',   value: m.phone,   variant: 'link' },
        { label: 'Address', value: m.address, variant: 'link' },
        { label: 'Website', value: 'Manage booking', variant: 'link' },
      ]} />
      <View style={s.distPad}>
        <DistanceModule label={m.distanceLabel} value={m.distanceValue} stopColor={stopColor} />
      </View>
      <View style={s.bottomPad} />
    </BottomSheetScrollView>
  );
}

function TRow({ icon, color, title, sub, last = false }: { icon: string; color: string; title: string; sub: string; last?: boolean }) {
  return (
    <View style={[s.tRow, !last && s.tRowBorder]}>
      <View style={[s.tIcon, { backgroundColor: hexWithAlpha(color, 0.12) }]}>
        <Text style={s.tIconTxt}>{icon}</Text>
      </View>
      <View>
        <Text style={s.tTitle}>{title}</Text>
        <Text style={s.tSub}>{sub}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  scroll:     { flexGrow: 1 },
  badge:      { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, marginBottom: 8 },
  badgeTxt:   { fontSize: 11, fontWeight: '700' as const, fontFamily: 'DMSans' },
  heroDates:  { fontSize: 26, fontWeight: '800' as const, color: Core.white, fontFamily: 'DMSans', letterSpacing: -0.5, marginBottom: 3 },
  heroMeta:   { fontSize: 13, color: 'rgba(255,255,255,0.65)', fontFamily: 'DMSans' },
  titleRow:   { padding: Spacing.base, paddingBottom: Spacing.sm, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  titleLeft:  { flex: 1 },
  name:       { fontFamily: 'Fraunces', fontSize: 26, color: Core.text, marginBottom: 3, lineHeight: 30 },
  subtitle:   { ...Typography.roles.meta, color: Core.textMuted, lineHeight: 18 },
  ratingCol:  { alignItems: 'flex-end', gap: 3, flexShrink: 0 },
  stars:      { fontSize: 13, color: '#C89A2B', fontWeight: '700' as const, fontFamily: 'DMSans' },
  ratingCount:{ fontSize: 11, color: Core.textFaint, fontFamily: 'DMSans' },
  section:    { paddingHorizontal: Spacing.base, paddingTop: Spacing.md },
  sectionTitle:{ fontSize: 11, fontFamily: 'DMSans', fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase', color: Core.textFaint, marginBottom: Spacing.sm },
  timeline:   { backgroundColor: Core.surface, borderWidth: 1, borderRadius: Radius.xl, overflow: 'hidden', marginBottom: Spacing.md },
  tRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  tRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Core.border },
  tIcon:      { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tIconTxt:   { fontSize: 16 },
  tTitle:     { fontSize: 13, fontWeight: '600' as const, fontFamily: 'DMSans', color: Core.text },
  tSub:       { fontSize: 11, color: Core.textMuted, fontFamily: 'DMSans', marginTop: 1 },
  amenityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: Spacing.md },
  amenity:    { height: 28, paddingHorizontal: 10, borderRadius: 999, backgroundColor: Core.surface, borderWidth: 1, borderColor: Core.border, alignItems: 'center', justifyContent: 'center' },
  amenityTxt: { fontSize: 11, fontWeight: '600' as const, fontFamily: 'DMSans', color: Core.textMuted },
  distPad:    { paddingHorizontal: Spacing.base },
  bottomPad:  { height: 32 },
});
```

- [ ] **Step 2: Create `src/features/jernie/sheets/FlightSheet.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import { SheetHero } from './SheetHero';
import { InfoSection, DistanceModule } from './SheetParts';
import { MOCK_FLIGHT } from './mockEntityData';
import { Core, Brand, Semantic, Typography, Spacing, Radius } from '@/src/design/tokens';
import type { FlightBooking } from '@/src/types';

interface FlightSheetProps {
  booking: FlightBooking;
  stopColor: string;
  onClose: () => void;
}

const STATUS: Record<string, { label: string; bg: string; border: string; color: string }> = {
  on_time:   { label: '● On Time',   bg: 'rgba(62,123,82,0.32)',  border: 'rgba(100,200,140,0.35)', color: '#b0f0c8' },
  delayed:   { label: '⚠ Delayed',   bg: 'rgba(181,107,0,0.32)',  border: 'rgba(220,160,50,0.4)',   color: '#fdd' },
  cancelled: { label: '✕ Cancelled', bg: 'rgba(163,72,95,0.32)',  border: 'rgba(200,100,120,0.35)', color: '#fcc' },
  landed:    { label: '✓ Landed',    bg: 'rgba(62,123,82,0.32)',  border: 'rgba(100,200,140,0.35)', color: '#b0f0c8' },
  unknown:   { label: '? Unknown',   bg: 'rgba(80,80,80,0.32)',   border: 'rgba(150,150,150,0.35)', color: '#ddd' },
};

export function FlightSheet({ booking, stopColor, onClose }: FlightSheetProps) {
  const m = MOCK_FLIGHT;
  const st = STATUS[m.status] ?? STATUS.unknown;

  return (
    <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
      <SheetHero mode="travel" stopColor={Brand.navy} onClose={onClose}>
        <View style={[s.badge, { backgroundColor: st.bg, borderColor: st.border }]}>
          <Text style={[s.badgeTxt, { color: st.color }]}>{st.label}</Text>
        </View>
        <View style={s.heroRoute}>
          <View>
            <Text style={s.heroAirport}>{booking.origin}</Text>
            <Text style={s.heroMeta}>{booking.departureTime}{m.terminal_origin ? ` · Terminal ${m.terminal_origin}` : ''}</Text>
          </View>
          <Text style={s.heroArrow}>→</Text>
          <View>
            <Text style={s.heroAirport}>{booking.destination}</Text>
            <Text style={s.heroMeta}>{booking.arrivalTime}</Text>
          </View>
        </View>
      </SheetHero>

      <View style={s.titleBlock}>
        <Text style={s.name}>{booking.origin} → {booking.destination} · {booking.flightNumber}</Text>
        <Text style={s.subtitle}>{booking.airline} · {booking.departureDate}</Text>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Flight Status</Text>
        <LinearGradient colors={[Brand.navy, '#1a3d5c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.flightBlock}>
          <View style={s.flRoute}>
            <View style={s.flEnd}>
              <Text style={s.flAirport}>{booking.origin}</Text>
              <Text style={s.flTime}>{booking.departureTime}</Text>
            </View>
            <Text style={s.flArrow}>→</Text>
            <View style={[s.flEnd, s.flEndRight]}>
              <Text style={s.flAirport}>{booking.destination}</Text>
              <Text style={s.flTime}>{booking.arrivalTime}</Text>
            </View>
          </View>
          <View style={s.flMeta}>
            {m.gate_origin    && <MetaItem label="Gate"     value={m.gate_origin} />}
            {m.aircraft_type  && <MetaItem label="Aircraft" value={m.aircraft_type} />}
            <MetaItem label="Flight" value={booking.flightNumber} />
          </View>
        </LinearGradient>
      </View>

      <InfoSection title="Status" rows={[
        { label: 'Status',      value: m.status === 'on_time' ? 'On Time' : m.status, variant: m.status === 'on_time' ? 'link' : 'warning' },
        { label: 'Departs',     value: `${booking.departureTime}${m.gate_origin ? ` · Gate ${m.gate_origin}` : ''}${m.terminal_origin ? ` · Terminal ${m.terminal_origin}` : ''}` },
        { label: 'Arrives',     value: `${booking.arrivalTime}${m.terminal_destination ? ` · Terminal ${m.terminal_destination}` : ''}` },
        { label: 'Leave hotel', value: m.leaveByLabel, variant: 'warning' },
      ]} />

      <InfoSection title="After Landing" rows={[
        { label: 'Rental car',  value: m.afterLanding.rentalLabel },
        { label: 'Drive to BH', value: m.afterLanding.driveLabel },
      ]} />
      <View style={s.distPad}>
        <DistanceModule label={m.afterLanding.distanceLabel} value={m.afterLanding.distanceValue} stopColor={stopColor} />
      </View>
      <View style={s.bottomPad} />
    </BottomSheetScrollView>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={s.flMetaLabel}>{label}</Text>
      <Text style={s.flMetaValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  scroll:       { flexGrow: 1 },
  badge:        { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, marginBottom: 8 },
  badgeTxt:     { fontSize: 11, fontWeight: '700' as const, fontFamily: 'DMSans' },
  heroRoute:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroAirport:  { fontSize: 28, fontWeight: '800' as const, color: Core.white, fontFamily: 'DMSans', letterSpacing: -0.5 },
  heroArrow:    { fontSize: 18, color: 'rgba(255,255,255,0.45)', paddingHorizontal: 4 },
  heroMeta:     { fontSize: 12, color: 'rgba(255,255,255,0.65)', fontFamily: 'DMSans', marginTop: 3 },
  titleBlock:   { padding: Spacing.base, paddingBottom: Spacing.sm },
  name:         { fontFamily: 'Fraunces', fontSize: 22, color: Core.text, marginBottom: 3, lineHeight: 26 },
  subtitle:     { ...Typography.roles.meta, color: Core.textMuted, lineHeight: 18 },
  section:      { paddingHorizontal: Spacing.base, paddingTop: Spacing.md },
  sectionTitle: { fontSize: 11, fontFamily: 'DMSans', fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase', color: Core.textFaint, marginBottom: Spacing.sm },
  flightBlock:  { borderRadius: 18, padding: Spacing.md, marginBottom: Spacing.sm },
  flRoute:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  flEnd:        { flex: 1 },
  flEndRight:   { alignItems: 'flex-end' },
  flAirport:    { fontSize: 28, fontWeight: '800' as const, color: Core.white, fontFamily: 'DMSans', letterSpacing: -0.5 },
  flTime:       { fontSize: 14, fontWeight: '700' as const, color: 'rgba(255,255,255,0.75)', fontFamily: 'DMSans', marginTop: 4 },
  flArrow:      { color: 'rgba(255,255,255,0.4)', fontSize: 20, paddingHorizontal: 4 },
  flMeta:       { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  flMetaLabel:  { fontSize: 10, fontWeight: '600' as const, fontFamily: 'DMSans', color: 'rgba(255,255,255,0.4)', letterSpacing: 0.8, textTransform: 'uppercase' as const, marginBottom: 2 },
  flMetaValue:  { fontSize: 15, fontWeight: '700' as const, fontFamily: 'DMSans', color: Core.white },
  distPad:      { paddingHorizontal: Spacing.base },
  bottomPad:    { height: 32 },
});
```

- [ ] **Step 3: `npx jest`** — expect pass.

- [ ] **Step 4: Commit**

```bash
git add src/features/jernie/sheets/HotelSheet.tsx src/features/jernie/sheets/FlightSheet.tsx
git commit -m "feat: add HotelSheet and FlightSheet content components"
```

---

## Task 6: `EntityDetailSheet` orchestrator

**Files:**
- Create: `src/features/jernie/sheets/EntityDetailSheet.tsx`

**Interfaces:**
- Consumes: `BottomSheetModal`, `BottomSheetBackdrop`, `BottomSheetBackdropProps` from `@gorhom/bottom-sheet`; `useSheetContext`; all 4 entity sheets; `EntitySheetPayload`
- Produces: `EntityDetailSheet` component accepting `sheetRef`, `payload`, `onDismiss`

- [ ] **Step 1: Create `src/features/jernie/sheets/EntityDetailSheet.tsx`**

```tsx
import React, { useCallback, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSheetContext } from '@/src/contexts/SheetContext';
import type { EntitySheetPayload } from './types';
import { RestaurantSheet } from './RestaurantSheet';
import { HikeSheet } from './HikeSheet';
import { HotelSheet } from './HotelSheet';
import { FlightSheet } from './FlightSheet';
import { Core } from '@/src/design/tokens';

interface EntityDetailSheetProps {
  sheetRef: React.RefObject<BottomSheetModal>;
  payload: EntitySheetPayload | null;
  onDismiss: () => void;
}

export function EntityDetailSheet({ sheetRef, payload, onDismiss }: EntityDetailSheetProps) {
  const { increment, decrement } = useSheetContext();
  const wasOpen = useRef(false);

  const handleChange = useCallback((index: number) => {
    if (index >= 0 && !wasOpen.current) {
      wasOpen.current = true;
      increment();
    } else if (index === -1 && wasOpen.current) {
      wasOpen.current = false;
      decrement();
      onDismiss();
    }
  }, [increment, decrement, onDismiss]);

  const renderBackdrop = useCallback((props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      pressBehavior="close"
      opacity={0.45}
    />
  ), []);

  const handleClose = useCallback(() => {
    sheetRef.current?.dismiss();
  }, [sheetRef]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['95%']}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      onChange={handleChange}
      handleIndicatorStyle={s.handle}
      backgroundStyle={s.background}
    >
      {payload?.kind === 'restaurant' && (
        <RestaurantSheet
          name={payload.name}
          stopLabel={payload.stopLabel}
          stopColor={payload.stopColor}
          onClose={handleClose}
        />
      )}
      {payload?.kind === 'hike' && (
        <HikeSheet
          name={payload.name}
          stopLabel={payload.stopLabel}
          stopColor={payload.stopColor}
          onClose={handleClose}
        />
      )}
      {payload?.kind === 'hotel' && (
        <HotelSheet
          booking={payload.booking}
          stopColor={payload.stopColor}
          stopLabel={payload.stopLabel}
          onClose={handleClose}
        />
      )}
      {payload?.kind === 'flight' && (
        <FlightSheet
          booking={payload.booking}
          stopColor={payload.stopColor}
          onClose={handleClose}
        />
      )}
    </BottomSheetModal>
  );
}

const s = StyleSheet.create({
  handle:     { backgroundColor: Core.border, width: 36, height: 4 },
  background: { backgroundColor: Core.bg, borderRadius: 24 },
});
```

- [ ] **Step 2: `npx jest`** — expect pass.

- [ ] **Step 3: Commit**

```bash
git add src/features/jernie/sheets/EntityDetailSheet.tsx
git commit -m "feat: add EntityDetailSheet BottomSheetModal orchestrator"
```

---

## Task 7: Wire entry points

**Files:**
- Modify: `src/features/jernie/components/TravelCard.tsx`
- Modify: `src/features/jernie/components/ItineraryDayRow.tsx`
- Modify: `src/features/jernie/StopSection.tsx`
- Modify: `app/(trips)/[tripId]/(tabs)/jernie.tsx`

- [ ] **Step 1: Add `onPress` to `TravelCard.tsx`**

Add to `TravelCardProps`:
```typescript
interface TravelCardProps {
  booking: Booking;
  stopColor: string;
  stopCity?: string;
  onPress?: () => void;  // ADD THIS
}
```

Wrap each sub-card's outermost element in `TouchableOpacity`. Example for `FlightCard` (repeat pattern for Hotel, Rental, Restaurant):
```tsx
// Replace <LinearGradient ...> with:
<TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.85 : 1} disabled={!onPress}>
  <LinearGradient ... >
    {/* existing content unchanged */}
  </LinearGradient>
</TouchableOpacity>
```

Pass `onPress` through from `TravelCard` to each sub-card:
```tsx
export function TravelCard({ booking, stopColor, stopCity, onPress }: TravelCardProps) {
  if (booking.type === 'flight')     return <FlightCard booking={booking} stopCity={stopCity} onPress={onPress} />;
  if (booking.type === 'hotel')      return <HotelCard  booking={booking} stopColor={stopColor} onPress={onPress} />;
  if (booking.type === 'rental')     return <RentalCard booking={booking} stopColor={stopColor} onPress={onPress} />;
  if (booking.type === 'restaurant') return <RestaurantCard booking={booking} onPress={onPress} />;
  return null;
}
```

Update each sub-card's props type to include `onPress?: () => void` and add `TouchableOpacity` wrapper.

- [ ] **Step 2: Add `onItemPress` to `ItineraryDayRow.tsx`**

Add to `ItineraryDayRowProps`:
```typescript
interface ItineraryDayRowProps {
  // ... existing props
  onItemPress?: (item: ItineraryItem) => void;  // ADD THIS
}
```

In the item rows JSX, wrap the `<View style={styles.itemRow}>` in `TouchableOpacity`:
```tsx
// Replace:
<View style={styles.itemRow}>

// With (when onItemPress is present and item has a category we handle):
<TouchableOpacity
  onPress={() => onItemPress?.(item)}
  activeOpacity={onItemPress ? 0.7 : 1}
  style={styles.itemRow}
>
```

Change the closing `</View>` to `</TouchableOpacity>` for the item row. Import `TouchableOpacity` from `react-native`.

Also import `ItineraryItem` type at the top (it's used in the prop):
```tsx
import type { ItineraryDay, ItineraryItem, ItineraryItemCategory } from '@/src/types';
```

- [ ] **Step 3: Update `StopSection.tsx` to thread callbacks**

```tsx
interface StopSectionProps {
  stop: Stop;
  bookings: Booking[];
  days: ItineraryDay[];
  expandedDayId: string | null;
  onDayPress: (dayId: string | null) => void;
  onBookingPress?: (booking: Booking) => void;   // ADD
  onItemPress?: (item: ItineraryItem) => void;   // ADD
}

// Pass through in render:
{bookings.map(booking => (
  <TravelCard
    key={booking.id}
    booking={booking}
    stopColor={stop.color}
    stopCity={stop.city}
    onPress={onBookingPress ? () => onBookingPress(booking) : undefined}  // ADD
  />
))}

// And on ItineraryDayRow:
<ItineraryDayRow
  key={day.id}
  day={day}
  dayNumber={idx + 1}
  stopColor={stop.color}
  isExpanded={expandedDayId === day.id}
  onPress={() => onDayPress(expandedDayId === day.id ? null : day.id)}
  onItemPress={onItemPress}  // ADD
/>
```

Add `ItineraryItem` to the import:
```tsx
import type { Stop, Booking, ItineraryDay, ItineraryItem } from '@/src/types';
```

- [ ] **Step 4: Wire sheet in `jernie.tsx`**

Add these imports at the top:
```tsx
import { useRef, useState } from 'react';  // add useState if not already there
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { EntityDetailSheet } from '@/src/features/jernie/sheets/EntityDetailSheet';
import type { EntitySheetPayload } from '@/src/features/jernie/sheets/types';
import type { Booking, ItineraryItem } from '@/src/types';
```

Inside `JernieTab()`, add:
```tsx
const sheetRef = useRef<BottomSheetModal>(null);
const [sheetPayload, setSheetPayload] = useState<EntitySheetPayload | null>(null);

const openSheet = useCallback((payload: EntitySheetPayload) => {
  setSheetPayload(payload);
  // Present after state update — use setTimeout to avoid race
  setTimeout(() => sheetRef.current?.present(), 0);
}, []);

const handleBookingPress = useCallback((booking: Booking) => {
  const stop = stops.find(s => s.id === booking.stopId) ?? stops[0];
  if (booking.type === 'hotel') {
    openSheet({ kind: 'hotel', booking, stopColor: stop.color, stopLabel: stop.city });
  } else if (booking.type === 'flight') {
    openSheet({ kind: 'flight', booking, stopColor: stop.color, stopLabel: stop.city });
  }
}, [stops, openSheet]);

const handleItemPress = useCallback((item: ItineraryItem, stop: Stop) => {
  const label = item.label ?? '';
  if (item.category === 'restaurant') {
    openSheet({ kind: 'restaurant', name: label, stopLabel: stop.city, stopColor: stop.color });
  } else if (item.category === 'hike') {
    openSheet({ kind: 'hike', name: label, stopLabel: stop.city, stopColor: stop.color });
  }
}, [openSheet]);
```

In the `StopSection` render, add callbacks:
```tsx
<StopSection
  stop={stop}
  bookings={bookingsByStop[stop.id] ?? []}
  days={itinerary[stop.id] ?? []}
  expandedDayId={expandedDayIds[stop.id] ?? null}
  onDayPress={dayId => handleDayPress(stop.id, dayId)}
  onBookingPress={handleBookingPress}
  onItemPress={item => handleItemPress(item, stop)}
/>
```

At the bottom of the main `View`, before the closing tag, add:
```tsx
<EntityDetailSheet
  sheetRef={sheetRef}
  payload={sheetPayload}
  onDismiss={() => setSheetPayload(null)}
/>
```

- [ ] **Step 5: `npx jest`** — expect pass.

- [ ] **Step 6: Commit**

```bash
git add \
  src/features/jernie/components/TravelCard.tsx \
  src/features/jernie/components/ItineraryDayRow.tsx \
  src/features/jernie/StopSection.tsx \
  "app/(trips)/[tripId]/(tabs)/jernie.tsx"
git commit -m "feat: wire entity detail sheet entry points — TravelCard tap + ItineraryItem tap"
```

---

## Verification

1. Run `npx expo start` — connect device via Tailscale
2. Open any trip → Jernie tab
3. Tap a **hotel booking card** → hotel sheet opens with check-in dates and amenities
4. Tap a **flight booking card** → flight sheet opens with route block and status
5. Expand an itinerary day → tap a **restaurant** or **hike** item row → place sheet opens with photos, reviews, CTA
6. CTA on restaurant/hike: tap "Add to [Stop]" → transforms to gold "In your itinerary" pill
7. Drag sheet down → dismisses with backdrop fade
8. Tap backdrop → dismisses
9. Tap ✕ close button → dismisses
10. After dismiss, reopen same or different entity → payload renders correctly (no stale content)
11. `npx jest` — all tests pass
