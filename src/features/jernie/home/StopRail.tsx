// The stop rail — the only navigation between stops.
//
// Floats 56px up onto the hero at rest, above it in z-order, and fades out by the halfway
// point of the collapse; the pinned bar inside the header takes over from there. The rail is
// an overlay rather than scroll content because it does not scroll with the content — it
// tracks the hero's bottom edge and leaves with it. Its space in the list is reclaimed by a
// collapsing spacer, so nothing below it is left floating in a hole.
//
// The card is custom; the scroll is not. A horizontal ScrollView with `snapToInterval` is
// ~30 lines — carousel libraries own their own scroll handler and would fight the collapse.
// See reference/custom-components.md.
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, useWindowDimensions, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { Animation } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { ImagePlaceholder, Photo, STOP_CARD_GAP, StopCard, stopCardWidth } from '@/src/ui';
import { RAIL_PAD_TOP, RAIL_TOP, RANGE, cardLeft } from './collapse';
import { StopDots } from './StopDots';

export interface RailStop {
  id: string;
  name: string;
  dates: string;
  kicker: string;
  status: string;
  statusTone: 'accent' | 'warning';
  count: string;
  photo?: string;
}

export interface StopRailProps {
  stops: RailStop[];
  index: number;
  scrollY: SharedValue<number>;
  transitionActive: SharedValue<number>;
  onSelect: (index: number) => void;
  onLayoutHeight: (h: number) => void;
}

export function StopRail({
  stops, index, scrollY, transitionActive, onSelect, onLayoutHeight,
}: StopRailProps) {
  const [s, t] = useStyles();
  const { width } = useWindowDimensions();
  const railRef = useRef<ScrollView>(null);
  const settledRef = useRef(index);
  const userDragRef = useRef(false);
  const scrollSequenceRef = useRef(0);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The latest destination while the rail is following app state. This must be an index,
  // not a boolean: vertical timeline scrolling can move the stop more than once before an
  // earlier horizontal animation finishes. A stale momentum-end from that earlier move must
  // not clear ownership and report its old card as a fresh user selection.
  const programmaticTargetRef = useRef<number | null>(null);

  // Shared with StopMorph, which starts its journey from exactly this x — see collapse.ts.
  const sideInset = cardLeft(width);
  // The card is a share of the screen, so the snap grid is too. Everything that rounds a
  // scroll offset to an index reads this one value.
  const snap = stopCardWidth(width) + STOP_CARD_GAP;
  const lastOffsetRef = useRef(index * snap);

  // `contentOffset` is an INITIAL offset, not a controlled one. Now that the index changes
  // mid-scroll, re-rendering with a new value made RN re-apply it and yank the drag out from
  // under the user, which is what stopped cards landing centred. Frozen on first render;
  // every later move goes through scrollTo.
  const initialOffset = useRef({ x: index * snap, y: 0 }).current;

  // Stable identity — a fresh style array on every scroll frame makes the ScrollView
  // re-apply its content container mid-gesture.
  const trackStyle = useMemo(() => [s.track, { paddingHorizontal: sideInset }], [s.track, sideInset]);

  // Gone by the halfway point, which is exactly where the pinned bar starts arriving.
  const fade = useAnimatedStyle(() => {
    const p = interpolate(scrollY.value, [0, RANGE / 2], [1, 0], Extrapolation.CLAMP);
    return {
      opacity: p,
      // Leaves with the hero rather than scrolling at its own pace: the rail is part of the
      // header system, not part of the list.
      transform: [{ translateY: interpolate(scrollY.value, [0, RANGE], [0, -RANGE * 1.6], Extrapolation.CLAMP) }],
      // Faded out means gone, not merely transparent — otherwise the cards keep taking taps
      // over the collapsed header.
      pointerEvents: p > 0.02 ? 'auto' : 'none',
    };
  });

  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current !== null) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = null;
  }, []);

  const scrollToIndex = useCallback((i: number, animated = true) => {
    const targetX = i * snap;
    const sequence = scrollSequenceRef.current + 1;
    scrollSequenceRef.current = sequence;
    clearSettleTimer();
    userDragRef.current = false;
    programmaticTargetRef.current = i;
    transitionActive.value = animated ? 1 : 0;
    railRef.current?.scrollTo({ x: targetX, animated });
    if (animated) {
      // RN does not guarantee a completion callback when one programmatic `scrollTo`
      // interrupts another. The token-timed backstop parks the latest card exactly on its
      // snap point, then returns visual ownership to the morph.
      settleTimerRef.current = setTimeout(() => {
        if (scrollSequenceRef.current !== sequence || programmaticTargetRef.current !== i) return;
        railRef.current?.scrollTo({ x: targetX, animated: false });
        lastOffsetRef.current = targetX;
        programmaticTargetRef.current = null;
        transitionActive.value = 0;
        settleTimerRef.current = null;
      }, Animation.duration.slow);
    }
  }, [clearSettleTimer, snap, transitionActive]);

  useEffect(() => () => {
    clearSettleTimer();
    transitionActive.value = 0;
  }, [clearSettleTimer, transitionActive]);

  // The header's dots can change the stop without the rail having moved. Follow, but only
  // when the change came from outside — matching on settledRef avoids fighting a live drag.
  useEffect(() => {
    if (index !== settledRef.current) {
      settledRef.current = index;
      // Animate only while the expanded rail is actually being viewed. A hidden rail is
      // parked immediately so it cannot reappear halfway between cards after the hero opens.
      scrollToIndex(index, scrollY.get() <= 0.5);
    }
  }, [index, scrollToIndex, scrollY]);

  // Selection commits at the crossover — the instant the incoming card is more centred than
  // the outgoing one — not when the scroll finishes decelerating. Waiting for
  // `onMomentumScrollEnd` meant the card sat faded through the whole deceleration and only
  // lit up once everything had stopped, which reads as lag however fast the spring is.
  //
  // `settledRef` makes this cheap: the index changes at most once or twice per swipe, so
  // this is not a setState per frame. It also keeps the sync effect below from yanking a
  // scroll that is still under the user's thumb.
  const commit = useCallback((x: number) => {
    if (programmaticTargetRef.current !== null || !userDragRef.current) return;
    const i = Math.max(0, Math.min(Math.round(x / snap), stops.length - 1));
    if (i !== settledRef.current) {
      settledRef.current = i;
      onSelect(i);
    }
  }, [stops.length, onSelect, snap]);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    lastOffsetRef.current = x;
    commit(x);
  }, [commit]);

  // Backstop, and the guarantee that a card ends up centred. A scroll that ends without
  // crossing (a short drag that springs back) still has to resolve to a definite index, and
  // if the rest came to rest off the snap grid — an interrupted deceleration, a gesture that
  // fought a re-render — it is corrected here rather than left a few pixels out.
  // A state-driven scroll only releases ownership when it reaches the latest requested
  // card. If an older animation reports its completion first, restore the latest target and
  // ignore the old position; reporting it through `onSelect` would scroll the vertical
  // itinerary back to that stop's first day.
  const handleMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    lastOffsetRef.current = x;
    const programmaticTarget = programmaticTargetRef.current;
    if (programmaticTarget !== null) {
      const target = programmaticTarget * snap;
      if (Math.abs(x - target) <= 1) {
        programmaticTargetRef.current = null;
        clearSettleTimer();
        transitionActive.value = 0;
      } else {
        scrollToIndex(programmaticTarget);
      }
      return;
    }

    // Momentum without a live horizontal drag belongs to an interrupted programmatic move.
    // Never promote it to stop navigation; restore the state-owned card instead.
    if (!userDragRef.current) {
      scrollToIndex(settledRef.current, false);
      return;
    }
    clearSettleTimer();
    commit(x);
    userDragRef.current = false;
    const targetIndex = Math.max(0, Math.min(Math.round(x / snap), stops.length - 1));
    const target = targetIndex * snap;
    if (Math.abs(x - target) > 1) scrollToIndex(targetIndex);
    else transitionActive.value = 0;
  }, [clearSettleTimer, commit, scrollToIndex, stops.length, snap, transitionActive]);

  const handleTap = useCallback((i: number) => {
    userDragRef.current = false;
    settledRef.current = i;
    scrollToIndex(i);
    onSelect(i);
  }, [scrollToIndex, onSelect]);

  // A touch transfers ownership to the user. It also prevents a no-op `scrollTo` (which may
  // emit no momentum-end) from leaving the rail permanently marked as programmatic.
  const handleBeginDrag = useCallback(() => {
    userDragRef.current = true;
    scrollSequenceRef.current += 1;
    clearSettleTimer();
    programmaticTargetRef.current = null;
    transitionActive.value = 1;
  }, [clearSettleTimer, transitionActive]);

  // A snapped ScrollView normally reports momentum-end, but an interrupted or very short
  // gesture is allowed not to. Keep the rail in charge through the expected snap window,
  // then park the nearest card and complete the same ownership handoff.
  const handleEndDrag = useCallback(() => {
    const sequence = scrollSequenceRef.current;
    clearSettleTimer();
    settleTimerRef.current = setTimeout(() => {
      if (scrollSequenceRef.current !== sequence || !userDragRef.current) return;
      const x = lastOffsetRef.current;
      commit(x);
      userDragRef.current = false;
      const targetIndex = Math.max(0, Math.min(Math.round(x / snap), stops.length - 1));
      const targetX = targetIndex * snap;
      railRef.current?.scrollTo({ x: targetX, animated: false });
      lastOffsetRef.current = targetX;
      programmaticTargetRef.current = null;
      transitionActive.value = 0;
      settleTimerRef.current = null;
    }, Animation.duration.slow);
  }, [clearSettleTimer, commit, snap, stops.length, transitionActive]);

  return (
    <Animated.View
      style={[s.layer, fade]}
      onLayout={e => onLayoutHeight(e.nativeEvent.layout.height)}
      // Untouchable once it has faded past half, so a tap in that region reaches the list.
      pointerEvents="box-none"
    >
      <ScrollView
        ref={railRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={snap}
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={trackStyle}
        contentOffset={initialOffset}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onScrollBeginDrag={handleBeginDrag}
        onScrollEndDrag={handleEndDrag}
        onMomentumScrollEnd={handleMomentumEnd}
      >
        {stops.map((stop, i) => (
          <RailSlot
            key={stop.id} active={i === index} scrollY={scrollY}
            transitionActive={transitionActive}
          >
            <StopCard
              testID={`stop-card-${i}`}
              kicker={stop.kicker}
              name={stop.name}
              dates={stop.dates}
              status={stop.status}
              statusTone={stop.statusTone}
              count={stop.count}
              active={i === index}
              photo={stop.photo
                ? <Photo source={stop.photo} style={s.thumb} />
                : <ImagePlaceholder style={s.thumb} glyphSize={20} />}
              onPress={() => handleTap(i)}
            />
          </RailSlot>
        ))}
      </ScrollView>

      <View style={s.dotRow}>
        <StopDots count={stops.length} index={index} onPress={handleTap} tint={t.action} idle={t.textDisabled} />
      </View>
    </Animated.View>
  );
}

/**
 * The handoff to `StopMorph`.
 *
 * Above scroll zero the morph draws the active card full size in the same place, so the real
 * one steps out rather than doubling the shadow. During horizontal movement the rail owns
 * every card, including the active one, so it remains attached to the swipe. The morph takes
 * ownership back only after the selected card has snapped to centre.
 *
 * A component per card rather than one style handed to whichever card is active: a Reanimated
 * style belongs to one view, and moving it between two of them mid-commit is how you get the
 * "used in multiple components" warning and a frame of neither.
 */
function RailSlot({ active, scrollY, transitionActive, children }: {
  active: boolean;
  scrollY: SharedValue<number>;
  transitionActive: SharedValue<number>;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: active && scrollY.value > 0.5 && transitionActive.value === 0 ? 0 : 1,
  }));
  // flexShrink: 0 for the same reason the card carries it — a wrapper that can shrink puts
  // the cards off the snap grid, and every centring bug on this rail has started there.
  return <Animated.View style={[SLOT, style]}>{children}</Animated.View>;
}

const SLOT = { flexShrink: 0 } as const;

const useStyles = createThemedStyles(() => ({
  layer: { position: 'absolute', top: RAIL_TOP, left: 0, right: 0 },
  // paddingHorizontal is applied inline — it depends on the screen width, so that the
  // snapped card lands centred. Vertical padding leaves the card's shadow room to breathe.
  track: { gap: STOP_CARD_GAP, paddingBottom: 4, paddingTop: RAIL_PAD_TOP },
  thumb: { width: '100%', height: '100%' },
  dotRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 11 },
}));
