# The collapse system

*Distilled from `guidelines/collapse.html` in the source project. The numbers are the spec.*

One scroll value, `0 → 140`, drives every screen's header. It is the only structural
animation in the app. `--collapse-range: 140px` and `--header-collapsed: 96px` live in
`tokens/spacing.css`.

**Identity shrinks, navigation widens and pins, content stays still.**

| Scroll `y` | State |
| --- | --- |
| `0` | Photo full at **272px**, trip name visible, stop rail floating on top |
| `70` | Photo re-cropping, title fading, rail fading out |
| `140` | Photo at **96px**, rail pinned full-bleed as the header, content unmoved |

> The photo re-crops in place rather than translating, so no band ever appears above it.

## Why this is hand-built

This is one of the four entries in `custom-components.md`. Every "collapsing header"
library assumes the header *translates* upward. Ours keeps the image's top edge fixed and
reduces its height, re-cropping the photo — which is precisely why no black band appears
at the top during the transition. A library that translates cannot produce this.

## React Native shape

Per `react-native-mapping.md`: `react-native-reanimated` v4, already a dependency.

- One `useSharedValue` holding the scroll offset
- One `useAnimatedScrollHandler` on the scroll view
- Several `useAnimatedStyle`s all reading that single value via
  `interpolate(y, [0, 140], …)`

Do not create a second scroll value for the rail, the title, or the tab bar. They are all
derived from the same one — that is what keeps them in lockstep.

Content must not move. Only the header layer animates; the list below it stays where it is.
