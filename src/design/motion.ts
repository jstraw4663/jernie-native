// The app's motion vocabulary — one place that decides how content arrives and how it
// changes, so every screen moves the same way.
//
// Two transitions, because there are two kinds of change:
//
//   `rise`              — new content arriving. A short fade up, staggered by position, so
//                         the eye is told what changed rather than left to notice.
//   `useSwapTransition` — the *same* content, re-sorted or re-grouped by a control the user
//                         just moved. Directional: it travels the way the control did.
//
// Both are Reanimated, which `reference/react-native-mapping.md` names for every animation
// in this system, and both take their timing from `Animation` in tokens.ts rather than
// inventing numbers. See docs/redesign-roadmap.md.
import { useLayoutEffect, useRef } from 'react';
import {
  FadeInDown, useAnimatedStyle, useSharedValue, withSpring,
} from 'react-native-reanimated';
import { Animation } from './tokens';

// ── Arriving ─────────────────────────────────────────────────────────────────

/** How far a section travels on the way in. `FadeInDown` defaults to 25 — too much for a
 *  section, which should look placed rather than thrown. */
export const RISE = 10;
const STEP = 28;
/** Caps the stagger so a two-week stop does not spend most of a second dealing itself out.
 *  Worst case is 168ms of stagger plus a 175ms fade — ~343ms to the last visible section. */
const MAX_STEPS = 6;

/**
 * A section's entrance, `step` places down the screen. Key the animated view on whatever
 * identity should re-fire it — the home screen keys on the stop id, so changing stop
 * re-deals the sections and scrolling does not.
 */
export function rise(step: number) {
  return FadeInDown
    .duration(Animation.duration.fast)
    .delay(Math.min(step, MAX_STEPS) * STEP)
    .withInitialValues({ opacity: 0, transform: [{ translateY: RISE }] });
}

// ── Swapping ─────────────────────────────────────────────────────────────────

/** How far a re-grouped list travels. Small: this is a re-sort, not a navigation. */
export const SWAP_SHIFT = 22;

/**
 * The transition for a list that has just been re-grouped by a segmented control.
 *
 * Pass the selected option's **index**. Moving right sends the content in from the right and
 * moving left from the left, so the list travels the way your thumb did — the single most
 * useful thing motion can say here, because the rows themselves are largely the same rows.
 *
 * It springs on `springs.snappy`, which is the spring `SegmentedControl`'s own pill uses, so
 * the content and the control settle together rather than as two separate events.
 *
 * The data should swap on the same frame the animation starts; there is no fade-out. A
 * cross-fade would put a blank list on screen for half the transition, which reads as a load
 * rather than as a change.
 */
export function useSwapTransition(index: number) {
  const progress = useSharedValue(1);
  const shift = useSharedValue(0);
  const previous = useRef(index);

  // `useLayoutEffect`, not `useEffect`. The data swaps during the same render, so a
  // post-paint effect would show one frame of the new list at rest before yanking it back to
  // the start of the animation — a visible blink. This runs before that frame reaches the
  // screen, so the new content's first appearance is already the animation's first frame.
  useLayoutEffect(() => {
    if (previous.current === index) return;
    shift.value = index > previous.current ? SWAP_SHIFT : -SWAP_SHIFT;
    previous.current = index;
    progress.value = 0;
    progress.value = withSpring(1, Animation.springs.snappy);
  }, [index, progress, shift]);

  return useAnimatedStyle(() => ({
    opacity: progress.value,
    // Driven off the same value as the opacity, so the overshoot the spring gives `progress`
    // shows up as a small settle rather than as two things disagreeing.
    transform: [{ translateX: shift.value * (1 - progress.value) }],
  }));
}
