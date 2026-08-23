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
import { useCallback, useEffect, useRef } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, useWindowDimensions, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { createThemedStyles } from '@/src/design/useTheme';
import { ImagePlaceholder, Photo, STOP_CARD_WIDTH, StopCard } from '@/src/ui';
import { RAIL_TOP, RANGE } from './collapse';
import { StopDots } from './HomeHeader';

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

  // The snapped card is centred on the screen, which means the track's side inset is
  // whatever is left over either side of a 292 card — 49 on a 390pt phone. Without it the
  // first card parks hard left and only the middle of a three-stop trip ever looks centred.
  // Falls back to 14 (the canvas's flat padding) on anything too narrow to centre in.
  const sideInset = Math.max(14, (width - STOP_CARD_WIDTH) / 2);

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

  // Backstop: a scroll that ends without crossing (a short drag that springs back, or a
  // programmatic scroll) still has to land on a definite index.
  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => commit(e.nativeEvent.contentOffset.x),
    [commit],
  );

  const handleTap = useCallback((i: number) => {
    settledRef.current = i;
    scrollToIndex(i);
    onSelect(i);
  }, [scrollToIndex, onSelect]);

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
        contentContainerStyle={[s.track, { paddingHorizontal: sideInset }]}
        contentOffset={{ x: index * SNAP_INTERVAL, y: 0 }}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleMomentumEnd}
      >
        {stops.map((stop, i) => (
          <StopCard
            key={stop.id}
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
        ))}
      </ScrollView>

      <View style={s.dotRow}>
        <StopDots count={stops.length} index={index} onPress={handleTap} tint={t.action} idle={t.textDisabled} />
      </View>
    </Animated.View>
  );
}

const useStyles = createThemedStyles(() => ({
  layer: { position: 'absolute', top: RAIL_TOP, left: 0, right: 0 },
  // paddingHorizontal is applied inline — it depends on the screen width, so that the
  // snapped card lands centred. Vertical padding leaves the card's shadow room to breathe.
  track: { gap: 10, paddingBottom: 4, paddingTop: 2 },
  thumb: { width: '100%', height: '100%' },
  dotRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 11 },
}));
