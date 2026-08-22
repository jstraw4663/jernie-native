# Custom components register

**The rule: nothing custom that a maintained library already does.**

`react-native-mapping.md` assigns a library to every component and behaviour in this
system. This file records the exceptions — the places where we deliberately write our own
code — and why each one is justified.

## The blocking rule

> Before hand-rolling any component, check `reference/react-native-mapping.md`.
>
> - If it **assigns a library**, use that library. No exceptions, no "just this once".
> - If it **does not**, stop and propose the custom build to Jeremy *before writing it* —
>   name the libraries you considered and why each one fails.
> - On approval, add a row to the register below in the same change.
>
> **No custom component appears in a diff without having been called out first.**

The same applies to dependencies: do not add a library `react-native-mapping.md` does not
name without saying why first.

## Register

| Custom | Library rejected | Why |
| --- | --- | --- |
| `StopCard` rail | carousel libraries | A snapping `ScrollView` with three cards is ~30 lines. Carousel libs own their own scroll handler, which fights the 0–140 collapse animation. |
| Collapse header | collapsing-header libraries | Every one assumes the header *translates*. Ours re-crops the photo in place, which is why no black band ever appears above it. See `collapse.md`. |
| `SegmentedControl` | `@react-native-segmented-control` | iOS-only, and renders the platform control, which will not take our tokens. Ours is a 25-line `View`. |
| `GapRow` derivation | — | Business logic, not UI: compare each stop's date span against bookings of that type. Belongs in `src/domain/`, not in a component. |

| Icon registry (`src/design/icons.ts`) | icon-pack wrappers | Not a component — a lookup table. `iconFor(category, subtype)` resolves the two-axis taxonomy to a Phosphor glyph. The icons themselves are all `phosphor-react-native`; this only decides which one. |

<!-- Add new rows above this line. Include: what, the library you rejected, and why. -->

## Notes on the four

**`StopCard` rail.** The *card* is custom; the scroll is not. Use a horizontal
`Animated.ScrollView` from `react-native-gesture-handler` with `snapToInterval={302}` and
`decelerationRate="fast"`.

**Collapse header.** Reanimated v4 is already a dependency. One `useSharedValue`, one
`useAnimatedScrollHandler`, several `useAnimatedStyle`s. Do not introduce a second scroll
value.

**`SegmentedControl`.** `View` + three `Pressable`s, animated indicator via
`useAnimatedStyle`. The active pill is the only place `--shadow-row` is used.

**Icon registry.** Ten categories and ~70 subtypes, imported per-icon
(`phosphor-react-native/src/icons/<Name>`) because Metro does not tree-shake barrels and
phosphor's index is over 500KB. An unknown subtype falls back to its category's icon, and an
unknown category to `MapPin`, so old data degrades rather than throwing.

**`GapRow` derivation.** The *component* is a `Pressable` with `borderStyle: 'dashed'`
(Android needs `borderRadius` ≤ 15 or the dash renders square). The *logic* — which gaps
exist — is a pure function over stops and bookings and belongs in `src/domain/`. Only stays
and transport generate gaps; eating and doing are preferences and only ever count.
