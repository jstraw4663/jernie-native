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
| `Toggle` | React Native's `Switch` | `Switch` renders the platform control. iOS gives it the system green and will not take `--accent`; `trackColor` reaches the track but not the knob shadow or the 44×26 geometry. Ours is a `Pressable` + one `withSpring` progress driving translate and `interpolateColor` — 45 lines. Named in `react-native-mapping.md`'s primitive table, but never registered here. |
| `StopMorph` | shared-element / hero-transition libraries | The card and the collapsed header bar are one object that changes shape on a scroll value. Every shared-element library drives its own timeline off a navigation event, and there is no navigation here. ~190 lines of `interpolate` on the collapse value we already have. |
| `ProgressBar` | `react-native-progress`, `react-native-animated-progress` | Both are wrappers around the same thing this is: a `View` with an animated width. 15 lines against a dependency, an unmaintained one in the second case, and neither does the wizard's discrete-segment mode without fighting it. |

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

**`Toggle`.** `Pressable` + `withSpring` on a 0→1 progress: `translateX` for the knob,
`interpolateColor` for the track. `spring-snappy` (damping 44 / stiffness 400). The control
is 26px tall against a 44px minimum tap target, so it carries `hitSlop` of 9 top and bottom.
The knob stays white in both themes — against the resting grey it is `--shadow-row` that
separates it, not the fill.

**`ProgressBar`.** Two modes in one component: `segments` for the wizard header, `value` for
trip completeness. The continuous mode animates a pixel width off an `onLayout` measurement
rather than a percentage string — the string form works, but only once Reanimated has
resolved the parent's layout, which shows as a jump on first paint.

**`StopMorph`.** A second drawing of `StopCard`, laid out from the same exported
`STOP_CARD_METRICS` so the two are pixel-identical at rest. The rail's real card is on screen
at `scrollY === 0` and this one above it, both reading the same threshold in the same frame,
so the handoff has no seam and no doubled shadow. It exists because the real card lives inside
the rail's horizontal `ScrollView` and nothing in there can go full-bleed at the top of the
screen. Change a number in `StopCard`'s sheet without changing the metrics and the handoff
starts to flinch — that is the one way to break it.

**`GapRow` derivation.** The *component* is a `Pressable` with `borderStyle: 'dashed'`
(Android needs `borderRadius` ≤ 15 or the dash renders square). The *logic* — which gaps
exist — is a pure function over stops and bookings and belongs in `src/domain/`. Only stays
and transport generate gaps; eating and doing are preferences and only ever count.
