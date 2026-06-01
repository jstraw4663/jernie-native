# Sprint 2c — Jernie Tab UI Fidelity: Design Spec

**Goal:** Bring the four visible-content components (StopsStrip, StopSection, TravelCard, ItineraryDayRow) visually in line with the PWA mockup design language, using the existing token system throughout.

**What does NOT change:** data layer, context, hooks, animations (ItineraryDayRow spring is preserved), test files, snapshot tests.

---

## 1. Shared Utility: `hexWithAlpha`

Extract the existing inline `hexWithAlpha` helper from `ItineraryDayRow.tsx` into `src/utils/colors.ts` so all four components can share it. Converts a 6-digit hex color + 0–1 alpha into `rgba(r,g,b,a)`. Used everywhere stop colors need to be tinted.

---

## 2. StopsStrip — PWA Track Design

Replace the current pill-based strip with the PWA's "trip trail" visual:

**Structure:** `position: relative` container with two absolute-positioned connector `View`s behind a horizontally-scrollable content layer.

- **Connector track line** — 2px tall, `rgba(120,113,106,0.18)`, runs `left: H_PADDING` to `right: H_PADDING`, vertically centered. Fixed (doesn't scroll).
- **Progress line** — same height, colored with the active stop's `stop.color` + glow shadow, fills from the left edge to the horizontal midpoint of the active stop. Width = `(activeIdx / (stops.length - 1)) * trackWidth`. Fixed (doesn't scroll).
- **Past stops** — 30×30px circle, green-tint bg + green border, emoji centered, stop city name below in green.
- **Active stop** — expanded pill (min-width 172px): 40×40px emoji circle (stop-color at 14% alpha), city name in stop color, date range below. Card shadow + stop-color border.
- **Future stops** — 30×30px circle, muted bg + muted border, emoji centered, city name below in textFaint.

Track and progress lines sit behind the ScrollView via JSX order (no explicit zIndex). Container width measured via `onLayout`; initial value from `Dimensions.get('window').width`.

---

## 3. StopSection Header — Tinted Card

Replace the 3px left-border header with a rounded card:

- `borderRadius: 16`, border `1px` at `hexWithAlpha(stop.color, 0.18)`, background `hexWithAlpha(stop.color, 0.07)`
- Left: 34×34px emoji square (`hexWithAlpha(stop.color, 0.15)` bg, `borderRadius: 10`)
- Right: city name (`h2Bold`, Core.text) + date range (`meta`, Core.textMuted)
- `margin: Spacing.sm Spacing.base 0` — card floats in the content area

**Day grouping:** Wrap the `ItineraryDayRow` list in a `daysWrapper` View with `gap: 6` and `marginHorizontal: Spacing.base`, so each day card has visual breathing room.

**stopColor thread:** StopSection already passes `stopColor` to ItineraryDayRow. Add it to TravelCard too.

---

## 4. TravelCard — Type-Specific Designs

Add `stopColor: string` prop. Split the single card shell into three distinct visual treatments:

### FlightCard
Dark navy gradient card, full-bleed design. Uses only Brand/Core tokens (not stop color — flights are airline-branded, not destination-branded).

- Background: `linear-gradient` via `{ start: {x:0,y:0}, end: {x:1,y:1} }` from `Brand.navy` (`#0D2B3E`) to `#1E4566`
- `borderRadius: 18`, `margin: 0 Spacing.base Spacing.sm`, card shadow
- **Top row:** `{airline} · {flightNumber}` label (small caps, white at 55% alpha) + "On time" status chip (green tint, white text)
- **Route row:** three columns — departure airport code (22px, weight 800, white) + time below / arrow in center / arrival airport code + time
- **Footer** (shown only if `confirmationCode` present): hairline separator + single meta item "Confirmation · {code}"

### HotelCard
Surface card with stop-color tinting.

- Background: `Core.surface`, border `1px hexWithAlpha(stopColor, 0.18)`, `borderRadius: 16`, `margin: 0 Spacing.base Spacing.sm`
- Left: 34×34px icon square (`hexWithAlpha(stopColor, 0.12)` bg, `borderRadius: 10`), emoji `🏨`
- Right: hotel name (label, weight 700, Core.text) + check-in/out dates (meta, textMuted) + night count (label, stop color)

### RentalCard
Same shell pattern as HotelCard.

- Emoji `🚗`
- Company + car type (label) + pickup/dropoff dates (meta) + pickup location (meta, textMuted)

### RestaurantCard
Same shell pattern. Emoji `🍽️`. Restaurant name + date + time (if present) + party size (if present).

---

## 5. ItineraryDayRow — Card Wrapper

Replace the hairline `border-top` wrapper with a full card:

- `borderRadius: Radius.lg` (12), `backgroundColor: Core.surface`, `borderWidth: 1`, `borderColor: Core.border`, `overflow: 'hidden'`
- No explicit shadow — `overflow: 'hidden'` clips iOS shadows; the border alone provides sufficient visual separation
- Internal structure (header, animatedContainer, itemList) is **unchanged**

---

## 6. File Map

| Action   | Path                                              | Change |
|----------|---------------------------------------------------|--------|
| Create   | `src/utils/colors.ts`                             | `hexWithAlpha` shared utility |
| Modify   | `src/features/jernie/StopsStrip.tsx`              | Full redesign: track + dots + active pill |
| Modify   | `src/features/jernie/StopSection.tsx`             | Header card + daysWrapper + thread stopColor to TravelCard |
| Modify   | `src/features/jernie/components/TravelCard.tsx`   | Type-split: FlightCard, HotelCard, RentalCard, RestaurantCard |
| Modify   | `src/features/jernie/components/ItineraryDayRow.tsx` | Card wrapper style; import hexWithAlpha from colors.ts |

---

## 7. Testing

No new test files. Existing 63 tests must continue to pass. TypeScript strict check (`npx tsc --noEmit`) is the primary non-visual gate. Visual verification via Expo dev build on device.

Snapshot tests (`TripLoadingScreen`, `TripErrorScreen`) are unaffected — they don't render any of these components.
