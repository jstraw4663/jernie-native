// The one collapse system. Reference: .claude/skills/jernie-design/reference/collapse.md
//
// A single scroll value, 0 to 140, drives the whole header. Identity shrinks, navigation
// pins, content stays still. Do not add a second scroll value for the rail or the title —
// everything derives from this one, which is what keeps them in lockstep.
//
//   y=0    photo full at 272, trip name visible, stop rail floating on top
//   y=70   photo re-cropping, title faded, rail gone
//   y=140  photo collapsed, pinned stop bar is the header, content unmoved
//
// The photo **re-crops in place** rather than translating, which is why no band ever
// appears above it. Every collapsing-header library assumes a translate; that is the whole
// reason this is hand-built (see reference/custom-components.md).
import { Layout } from '@/src/design/tokens';

/** Resting hero height, full-bleed to the top of the screen. */
export const HERO_MAX = 272;

/** The scroll distance the whole app collapses over. `--collapse-range`. */
export const RANGE = Layout.collapseRange;   // 140

/** How far the stop rail floats up onto the photo at rest. */
export const RAIL_LIFT = 56;

/** The pinned stop bar that becomes the header — thumb, name, dates, dots. */
export const PINNED_BAR_H = 62;

/**
 * Collapsed header height.
 *
 * The design's `--header-collapsed` is a flat **96**, but the mockup renders no status bar,
 * so 96 would put the pinned bar's top third under the clock. The bar is what has to clear
 * the inset, so the real collapsed height is the inset plus the bar — which reproduces 96
 * exactly on a device reporting a 34pt top inset, and grows correctly on a notch or a
 * Dynamic Island instead of hiding behind it.
 */
export const heroMin = (insetTop: number) => insetTop + PINNED_BAR_H;

/** Where the rail's top sits at rest, measured from the top of the screen. */
export const RAIL_TOP = HERO_MAX - RAIL_LIFT;   // 216
