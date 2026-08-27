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

**3. The range is 165, not 140.** `--collapse-range` is 140 and the app stretches it by 18%.
The header was finished before the gesture felt finished, and a flick upward snapped the hero
back to full height. Nothing in the animation was wrong; there was not enough finger in it.
The stretch lives in `collapse.ts` rather than in `tokens.ts`, because tokens are regenerated
from `tokens/*.css` and would clobber it.

Every ramp on the screen is a fraction of that one number, so it stays the only place the
pacing is set.

Everything else here still holds — one scroll value, the photo re-cropping in place, no
second animation clock.

## Quick return

Reversing through the itinerary does not progressively reopen a fully collapsed header. A
slow reverse drag leaves the header pinned so the user can browse earlier days without losing
vertical space. Reopen it only when the end-drag velocity toward the beginning of the list is
at least **1.2 points/ms**; restore the full 272px hero, stop cards and CTA together over
**320ms ease-out**.

The threshold is intentionally velocity-based, not distance-based. React Native reports this
unit on both platforms, but Android's velocity sign follows the finger while iOS's follows the
content, so normalize direction at the event boundary. The lock is interaction state, not a
second animation coordinate: every structural element must continue to derive from the same
collapse shared value.

The absolute top of the itinerary is the exception to the velocity gate. Once native scroll
offset reaches zero there is no earlier content left to reveal, so the lock hands the remaining
pull back to the hero. Negative overscroll expands it directly where the platform exposes that
distance; releasing at the boundary completes the same 320ms ease-out. This keeps slow browsing
compact without trapping the compact header at the beginning of the trip.

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
