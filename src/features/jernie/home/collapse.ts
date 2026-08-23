// The one collapse system. Reference: .claude/skills/jernie-design/reference/collapse.md
//
// A single scroll value, 0 to 140, drives the whole header. Identity shrinks, navigation
// pins, content stays still. Do not add a second scroll value for the rail, the title or
// the morph — everything derives from this one, which is what keeps them in lockstep.
//
//   y=0    photo full at 272, trip name large, stop rail floating on top
//   y=70   photo re-cropping, trip name shrinking, the active card halfway to being the bar
//   y=140  photo at a title strip plus the bar, trip name still there, content unmoved
//
// The photo **re-crops in place** rather than translating, which is why no band ever
// appears above it. Every collapsing-header library assumes a translate; that is the whole
// reason this is hand-built (see reference/custom-components.md).
//
// TWO DELIBERATE DEVIATIONS from collapse.md, both Jeremy's call:
//
//  1. The collapsed header is taller than the spec's flat 96 and keeps the trip name and a
//     strip of photograph. The spec collapses to navigation alone; on device that threw
//     away the one thing that says which trip you are in.
//  2. The stop card does not cross-fade into the bar — it *becomes* it. See StopMorph.tsx.
import { Layout } from '@/src/design/tokens';
import { STOP_CARD_WIDTH } from '@/src/ui/StopCard';

/** Resting hero height, full-bleed to the top of the screen. */
export const HERO_MAX = 272;

/** The scroll distance the whole app collapses over. `--collapse-range`. */
export const RANGE = Layout.collapseRange;   // 140

/** How far the stop rail floats up onto the photo at rest. */
export const RAIL_LIFT = 56;

/** Vertical padding above the rail's cards, so their shadow has room. */
export const RAIL_PAD_TOP = 2;

/** The pinned stop bar the card becomes — thumb, name, dates, dots. */
export const PINNED_BAR_H = 62;

/**
 * The band of photograph that survives the collapse, holding the trip name.
 *
 * The design's `--header-collapsed` is a flat **96** and shows navigation only. Keeping 50px
 * of photograph and the trip name costs half a row of content and answers "which trip is
 * this" without scrolling back up.
 */
export const TITLE_STRIP_H = 50;

/**
 * Collapsed header height: status bar, then the title strip, then the bar.
 *
 * The inset is part of the sum rather than absorbed into a flat number because the mockup
 * renders no status bar — a flat height puts the strip's top third under the clock, and
 * grows wrong on a Dynamic Island instead of clearing it.
 */
export const heroMin = (insetTop: number) => insetTop + TITLE_STRIP_H + PINNED_BAR_H;

/** Where the bar comes to rest — the bottom `PINNED_BAR_H` of the collapsed header. */
export const barTop = (insetTop: number) => insetTop + TITLE_STRIP_H;

/** Where the rail's top sits at rest, measured from the top of the screen. */
export const RAIL_TOP = HERO_MAX - RAIL_LIFT;   // 216

/** Where the active card's top edge sits at rest — the frame the morph starts from. */
export const CARD_TOP = RAIL_TOP + RAIL_PAD_TOP;   // 218

/**
 * The snapped card's left edge, which is also the rail track's side padding.
 *
 * The rail centres the card it is parked on, so the inset is whatever is left over either
 * side of a 292 card — 49 on a 390pt phone. Falls back to the canvas's flat 14 on anything
 * too narrow to centre in. `StopRail` pads its track by this and `StopMorph` starts from
 * it; they have to be the same number or the morph appears a few pixels off the card.
 */
export const cardLeft = (width: number) => Math.max(14, (width - STOP_CARD_WIDTH) / 2);

// ── The trip name's journey ────────────────────────────────────────────────
// It is bottom-anchored inside the hero, so most of the travel is free: shrink the hero and
// the name rides up with it. Only the last 18px and the scale are animated.

/** The name's bottom edge, measured up from the hero's bottom edge. */
export const TITLE_BOTTOM = 95;

/** `Typography.roles.hero` lineHeight. 34px of Fraunces lands at 20 when scaled. */
const TITLE_BOX = 35;

/** Scaled rather than re-sized: animating `fontSize` re-lays-out the text every frame. */
export const TITLE_MIN_SCALE = 0.59;

/**
 * The residual nudge, once the shrinking hero has carried the name most of the way.
 *
 * Bottom-anchoring lands it `TITLE_STRIP_H + PINNED_BAR_H - TITLE_BOTTOM` below the inset;
 * centred in the strip it wants to be at half the strip plus half its own scaled box. The
 * difference is constant, which is why the inset cancels out and this is a number rather
 * than a function.
 */
export const TITLE_SHIFT =
  (TITLE_STRIP_H + TITLE_BOX * TITLE_MIN_SCALE) / 2 - (TITLE_STRIP_H + PINNED_BAR_H - TITLE_BOTTOM);

/**
 * What the list's leading spacer shrinks to, rather than to zero.
 *
 * The rail is an overlay, so the list carries a spacer of the rail's height that collapses
 * as the rail leaves. Collapsing it all the way to zero was right against a 96px header and
 * is wrong against this one — the first card would come to rest 70px behind the bar. This
 * is the height that lands it exactly on the header's bottom edge at `y = RANGE`; its own
 * `paddingTop` supplies the gap.
 */
export const spacerMin = (insetTop: number) => Math.max(0, heroMin(insetTop) - RAIL_TOP + RANGE);
