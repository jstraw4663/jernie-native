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

## Two deviations, shipped deliberately

Both are Jeremy's calls, made on device against the built screen. The table above is the
design's; the app does this instead.

**1. The collapsed header is taller and keeps the trip name.** `--header-collapsed` is a flat
96 showing navigation alone. On device that threw away the one thing that says *which trip
this is* — you scroll two rows and the screen could be any trip. The app collapses to
`inset + 50 + 62`: the status bar, a 50px strip of photograph carrying the trip name at 59%
scale, then the stop bar. The name is bottom-anchored inside the hero, so the shrinking
container carries it most of the way and only the last 18px and the scale are animated;
`fontSize` is never animated, because that re-measures the text every frame.

The list's leading spacer therefore collapses to `spacerMin(inset)` rather than to zero, or
the first card would come to rest 70px behind the taller bar.

**2. The stop card becomes the bar; it does not cross-fade into it.** The spec fades the card
out and the bar in. Two objects, one dying and one arriving. The app morphs a single object:
it widens to the screen, squares its corners, walks its thumbnail from the card's right edge
to the bar's left, sheds "Stop 2 of 3" and the status line, and grows its dots. See
`StopMorph` in `custom-components.md` for how the handoff from the rail's real card is made
seamless.

Everything else here still holds — one scroll value, the photo re-cropping in place, no
second animation clock.

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
