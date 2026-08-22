# React Native mapping

Every component and behaviour in this system, mapped to a library already in
`jernie-native` or one worth adding. The rule: **nothing custom that a maintained
library already does.** Custom code is listed only where no library fits.

Current deps that matter (from package.json @ master): Expo 56, RN 0.85.3,
expo-router 56, react-native-reanimated 4.3.1, react-native-gesture-handler 2.31,
@gorhom/bottom-sheet 5.2, react-native-calendars, react-native-mmkv,
@react-native-firebase/* 24, expo-apple-authentication, expo-linear-gradient.

## Already have it — use it

| Need | Library | Notes |
| --- | --- | --- |
| Every bottom sheet (detail, filter, exit, notifications, magic link) | `@gorhom/bottom-sheet` v5 | `snapPoints={['15%','55%','92%']}` for the three detents. Use `BottomSheetScrollView` inside; `enableDynamicSizing` for the short decision sheets. |
| Hero collapse, rail pin, sheet-driven map | `react-native-reanimated` v4 | One `useSharedValue` scroll offset, `useAnimatedScrollHandler`, `interpolate(y,[0,140],…)`. This is the 0–140 collapse system — one value, several `useAnimatedStyle`s. |
| Stop-rail swipe, sheet drag, row swipe actions | `react-native-gesture-handler` | Rail is a horizontal `Animated.ScrollView` with `snapToInterval={302}` `decelerationRate="fast"`, not a carousel lib. |
| Date range on wizard step 2 | `react-native-calendars` | `Calendar` with `markingType="period"`. Already a dep — do not add a second date lib. |
| Photo scrims over hero images | `expo-linear-gradient` | Exact stops in `tokens/colors.css`: `--scrim-top/mid/bottom`. |
| Draft persistence through app kill | `react-native-mmkv` | Wizard draft, collapse position, last-used filters. Replaces the in-memory `OnboardingDraftContext`. |
| Apple sign-in | `expo-apple-authentication` | Already wired. |
| Auth, trips, sync | `@react-native-firebase/auth` + `database` | Anonymous account on step 1, `linkWithCredential` on step 3 — no data migration. |
| Tabs and routes | `expo-router` | Five-tab `(tabs)` group; wizard as a modal stack outside it. |
| Safe-area insets (84px tab bar, 52px header) | `react-native-safe-area-context` | Never hard-code the 24px inset. |

## Add these

| Need | Library | Why this one |
| --- | --- | --- |
| Icons (Phosphor, ~90 glyphs used) | `phosphor-react-native` + `react-native-svg` | Same family as every mock in this system, regular + fill weights, tree-shakes. Import per-icon (`phosphor-react-native/src/icons/Star`) — Metro does not tree-shake barrels. Replaces the emoji currently in `step-1.tsx` and `step-4.tsx`. |
| Google sign-in | `@react-native-google-signin/google-signin` | The one passwordless provider not yet installed. |
| Email magic link | `@react-native-firebase/auth` `sendSignInLinkToEmail` + `expo-linking` | No new dependency; `expo-linking` is already there for the deep link back. |
| Map (route + Explore modes) | `react-native-maps` | Apple Maps on iOS, Google on Android, free. Route line = `Polyline`, stops = `Marker` with custom children. Use `@rnmapbox/maps` only if custom cartography becomes a requirement — it costs a token and a config plugin. |
| Photo lists (Explore grid, carousels) | `expo-image` | `cachePolicy="memory-disk"`, `transition` for the fade-in, `placeholder` for the blurhash. Plain `Image` re-fetches and flickers on scroll. |
| Long lists (Agenda, Explore grid) | `@shopify/flash-list` | Agenda can hold hundreds of rows across four groups. Sectioned via `data` + `stickyHeaderIndices`. |
| Loading skeletons | `react-native-reanimated` + `expo-linear-gradient` | The shimmer is 20 lines: a translating gradient over a grey block. `moti` is an option but pulls in its own animation layer — not worth it when Reanimated is already here. |
| Haptics on commit actions | `expo-haptics` | `impactAsync(Light)` on add-to-itinerary, sheet snap, stop change. |
| Notification permission + sends | `expo-notifications` | The permission sheet in the wizard is our own UI; the OS prompt only fires after a yes. |
| Blur behind pinned headers and chips | `expo-blur` | `--on-photo-chip` chips over photos. iOS only visually; falls back to solid on Android. |

## Deliberately custom

| Thing | Why not a library |
| --- | --- |
| `StopCard` rail | A snapping `ScrollView` with three cards is ~30 lines. Carousel libs fight the collapse animation because they own their own scroll handler. |
| `GapRow` derivation | Business logic, not UI: compare each stop's date span against bookings of that type. Belongs in `src/domain/`. |
| `SegmentedControl` | `@react-native-segmented-control` is iOS-only and renders the platform control, which will not take our tokens. Ours is a 25-line `View`. |
| Collapse header | Every "collapsing header" library assumes a translate. Ours re-crops the photo in place, which is why no black band appears. Do it by hand with Reanimated. |

## Component → RN primitive

| This system | React Native |
| --- | --- |
| `Button` | `Pressable` + `Text`, `android_ripple` off, `style={pressed && {opacity:.85}}` |
| `Chip` | `Pressable` + `Text`, `withSpring` on background (damping 34 / stiffness 280) |
| `Badge` | `View` + `Text`, no press state |
| `ListRow` | `Pressable` row inside `FlashList`; media is `expo-image` |
| `ItineraryRow` | same, with a fixed 44px mono time column |
| `GapRow` / `PromptRow` | `Pressable` with `borderStyle:'dashed'` — Android needs `borderRadius` ≤ 15 or the dash renders square |
| `SegmentedControl` | `View` + three `Pressable`s, animated indicator via `useAnimatedStyle` |
| `ProgressBar` | `View` + animated width, or 4 flex children for the wizard segments |
| `Toggle` | `Pressable` + `withSpring` translate — not RN's `Switch`, which cannot take these colours |
| `StopCard` | `Pressable` inside the snapping `ScrollView` |
| `StatStrip` | `View` row of `Text` pairs |

## Token bridge

`src/design/tokens.ts` keeps its **shape** (Brand / Core / Semantic / TypeColors) and
loses all of its **values**. Rewrite the file from `tokens/*.css` — do not merge, do not
keep the old palette behind a flag:

- `--surface` → `Core.surface`, `--ink` → `Core.text`, `--ink-2` → `Core.textMuted`
- `--accent` → `Core.action` = `#0F7B6C` (replaces `#2F6F73`)
- `--warning` → `Semantic.warning` (unchanged at `#B56B00`)
- `--type-*` → `TypeColors` (unchanged)
- Radii move from numbers to the role names in `tokens/spacing.css`
- Add a `dark` object mirroring `[data-theme="dark"]`, and select with `useColorScheme()`

`Brand.navy`, `Brand.gold` and `Core.bg`'s cream are deleted, not deprecated. Any screen
still referencing them is a screen that has not been migrated yet — that is the signal to
look for, so leaving them in place would hide it.
