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
import { createThemedStyles } from '@/src/design/useTheme';
import { ImagePlaceholder, Photo, STOP_CARD_WIDTH, StopCard } from '@/src/ui';
import { RAIL_PAD_TOP, RAIL_TOP, RANGE, cardLeft } from './collapse';
import { StopDots } from './StopDots';

/** Card width plus the 10px gap. The rail snaps on this, per react-native-mapping.md. */
export const SNAP_INTERVAL = STOP_CARD_WIDTH + 10;   // 302

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
  onSelect: (index: number) => void;
  onLayoutHeight: (h: number) => void;
}

export function StopRail({ stops, index, scrollY, onSelect, onLayoutHeight }: StopRailProps) {
  const [s, t] = useStyles();
  const { width } = useWindowDimensions();
  const railRef = useRef<ScrollView>(null);
  const settledRef = useRef(index);

  // True while the rail is scrolling itself. An animated `scrollTo` from card 0 to card 1
  // travels through every x in between, and the first half of that journey still rounds to
  // 0 — so without this, a tap on card 1 made `commit` "detect" a change back to 0, select
  // the wrong stop, and then change again on arrival. Two selections, two buzzes, content
  // remounted twice, for one tap.
  const selfScrollRef = useRef(false);

  // Shared with StopMorph, which starts its journey from exactly this x — see collapse.ts.
  const sideInset = cardLeft(width);

  // `contentOffset` is an INITIAL offset, not a controlled one. Now that the index changes
  // mid-scroll, re-rendering with a new value made RN re-apply it and yank the drag out from
  // under the user, which is what stopped cards landing centred. Frozen on first render;
  // every later move goes through scrollTo.
  const initialOffset = useRef({ x: index * SNAP_INTERVAL, y: 0 }).current;

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

  const scrollToIndex = useCallback((i: number, animated = true) => {
    selfScrollRef.current = true;
    railRef.current?.scrollTo({ x: i * SNAP_INTERVAL, animated });
  }, []);

  // The header's dots can change the stop without the rail having moved. Follow, but only
  // when the change came from outside — matching on settledRef avoids fighting a live drag.
  useEffect(() => {
    if (index !== settledRef.current) {
      settledRef.current = index;
      scrollToIndex(index);
    }
  }, [index, scrollToIndex]);

  // Selection commits at the crossover — the instant the incoming card is more centred than
  // the outgoing one — not when the scroll finishes decelerating. Waiting for
  // `onMomentumScrollEnd` meant the card sat faded through the whole deceleration and only
  // lit up once everything had stopped, which reads as lag however fast the spring is.
  //
  // `settledRef` makes this cheap: the index changes at most once or twice per swipe, so
  // this is not a setState per frame. It also keeps the sync effect below from yanking a
  // scroll that is still under the user's thumb.
  const commit = useCallback((x: number) => {
    if (selfScrollRef.current) return;
    const i = Math.max(0, Math.min(Math.round(x / SNAP_INTERVAL), stops.length - 1));
    if (i !== settledRef.current) {
      settledRef.current = i;
      onSelect(i);
    }
  }, [stops.length, onSelect]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => commit(e.nativeEvent.contentOffset.x),
    [commit],
  );

  // Backstop, and the guarantee that a card ends up centred. A scroll that ends without
  // crossing (a short drag that springs back) still has to resolve to a definite index, and
  // if the rest came to rest off the snap grid — an interrupted deceleration, a gesture that
  // fought a re-render — it is corrected here rather than left a few pixels out.
  // This cannot loop: the corrective scroll settles exactly on the grid, so the second
  // momentum-end finds nothing to fix.
  const handleMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    selfScrollRef.current = false;
    commit(x);
    const target = Math.max(0, Math.min(Math.round(x / SNAP_INTERVAL), stops.length - 1)) * SNAP_INTERVAL;
    if (Math.abs(x - target) > 1) railRef.current?.scrollTo({ x: target, animated: true });
  }, [commit, stops.length]);

  const handleTap = useCallback((i: number) => {
    settledRef.current = i;
    scrollToIndex(i);
    onSelect(i);
  }, [scrollToIndex, onSelect]);

  // Two ways out of the self-scroll flag, because relying on momentum-end alone would wedge
  // the rail if a `scrollTo` landed where it already was and emitted no event. A touch
  // always means the user is driving again.
  const handleBeginDrag = useCallback(() => { selfScrollRef.current = false; }, []);

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
        snapToInterval={SNAP_INTERVAL}
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={trackStyle}
        contentOffset={initialOffset}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onScrollBeginDrag={handleBeginDrag}
        onMomentumScrollEnd={handleMomentumEnd}
      >
        {stops.map((stop, i) => (
          <RailSlot key={stop.id} active={i === index} scrollY={scrollY}>
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
 * Above scroll zero the morph is drawing the active card full size and in the same place, so
 * the real one steps out rather than sitting underneath it doubling the shadow. Both sides
 * read this one threshold off the same shared value in the same frame — there is no window
 * in which both are drawn, and none in which neither is.
 *
 * A component per card rather than one style handed to whichever card is active: a Reanimated
 * style belongs to one view, and moving it between two of them mid-commit is how you get the
 * "used in multiple components" warning and a frame of neither.
 */
function RailSlot({ active, scrollY, children }: { active: boolean; scrollY: SharedValue<number>; children: ReactNode }) {
  const style = useAnimatedStyle(() => ({ opacity: active && scrollY.value > 0.5 ? 0 : 1 }));
  // flexShrink: 0 for the same reason the card carries it — a wrapper that can shrink puts
  // the cards off the snap grid, and every centring bug on this rail has started there.
  return <Animated.View style={[SLOT, style]}>{children}</Animated.View>;
}

const SLOT = { flexShrink: 0 } as const;

const useStyles = createThemedStyles(() => ({
  layer: { position: 'absolute', top: RAIL_TOP, left: 0, right: 0 },
  // paddingHorizontal is applied inline — it depends on the screen width, so that the
  // snapped card lands centred. Vertical padding leaves the card's shadow room to breathe.
  track: { gap: 10, paddingBottom: 4, paddingTop: RAIL_PAD_TOP },
  thumb: { width: '100%', height: '100%' },
  dotRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 11 },
}));
