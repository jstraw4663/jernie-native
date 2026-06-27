import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, RefreshControl,
  Dimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withSpring,
} from 'react-native-reanimated';
import { useTripContext } from '@/src/contexts/TripContext';
import { getActiveStopId, getAutoExpandDayIndex } from '@/src/domain/trip';
import { getDevNow } from '@/src/utils/devTime';
import { HeroLayer } from '@/src/features/jernie/HeroLayer';
import { SampleCTACarousel } from '@/src/features/jernie/SampleCTACarousel';
import { StopsStrip } from '@/src/features/jernie/StopsStrip';
import { StopSection } from '@/src/features/jernie/StopSection';
import { EntityDetailSheet } from '@/src/features/jernie/sheets/EntityDetailSheet';
import type { EntityDetailSheetRef } from '@/src/features/jernie/sheets/EntityDetailSheet';
import { Brand, Core } from '@/src/design/tokens';
import type { Booking, ItineraryItem, Stop } from '@/src/types';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function JernieTab() {
  const { trip, stops, bookings, itinerary, status, refetch } = useTripContext();

  const now = getDevNow();
  const activeStopId = getActiveStopId(stops, now);
  const activeStop = stops.find(s => s.id === activeStopId) ?? stops[0];

  const initialIdx = Math.max(0, stops.findIndex(s => s.id === activeStopId));
  const [viewedIdx, setViewedIdx] = useState(initialIdx);

  const pagerRef      = useRef<ScrollView>(null);
  const lastPageRef   = useRef(initialIdx);
  const originPageRef = useRef(initialIdx); // page index when drag began
  const entitySheetRef = useRef<EntityDetailSheetRef>(null);

  const scrollY          = useSharedValue(0);
  const carouselHeight   = useSharedValue(-1); // -1 = not yet measured
  const scrollHandler = useAnimatedScrollHandler(event => {
    scrollY.value = event.contentOffset.y;
  });

  const [expandedDayIds, setExpandedDayIds] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(stops.map(s => {
      const days = itinerary[s.id] ?? [];
      const idx = getAutoExpandDayIndex(days, now);
      return [s.id, idx >= 0 ? (days[idx]?.id ?? null) : null];
    }))
  );

  const bookingsByStop = useMemo(
    () => Object.fromEntries(
      stops.map(s => [s.id, bookings.filter((b: Booking) => b.stopId === s.id)])
    ),
    [stops, bookings],
  );

  const handleDayPress = useCallback(
    (stopId: string, dayId: string | null) =>
      setExpandedDayIds(prev => ({ ...prev, [stopId]: dayId })),
    [],
  );

  const handleBookingPress = useCallback((booking: Booking, stop: Stop) => {
    if (booking.type === 'hotel') {
      entitySheetRef.current?.present({ kind: 'hotel', booking, stopColor: stop.color, stopLabel: stop.city });
    } else if (booking.type === 'flight') {
      entitySheetRef.current?.present({ kind: 'flight', booking, stopColor: stop.color, stopLabel: stop.city });
    }
  }, []);

  const handleItemPress = useCallback((item: ItineraryItem, stop: Stop) => {
    const label = item.label ?? '';
    if (item.category === 'restaurant') {
      entitySheetRef.current?.present({ kind: 'restaurant', name: label, stopLabel: stop.city, stopColor: stop.color });
    } else if (item.category === 'hike') {
      entitySheetRef.current?.present({ kind: 'hike', name: label, stopLabel: stop.city, stopColor: stop.color });
    }
  }, []);

  // Capture which page the drag originated from (before the 50% crossover updates lastPageRef)
  const handleScrollBeginDrag = useCallback(() => {
    originPageRef.current = lastPageRef.current;
  }, []);

  // Weighted swipe: require deliberate velocity OR distance from the origin page
  const handleScrollEndDrag = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x   = e.nativeEvent.contentOffset.x;
    const vx  = e.nativeEvent.velocity?.x ?? 0;
    const origin    = originPageRef.current;
    const originX   = origin * SCREEN_WIDTH;
    const delta     = x - originX;

    const VELOCITY_THRESH = 0.45;            // pt/ms — requires a deliberate flick
    const DISTANCE_THRESH = SCREEN_WIDTH * 0.32; // 32% of screen width

    const meetsThreshold =
      Math.abs(vx) >= VELOCITY_THRESH || Math.abs(delta) >= DISTANCE_THRESH;

    if (!meetsThreshold) {
      // Snap back to the origin page and reset strip
      pagerRef.current?.scrollTo({ x: originX, animated: true });
      lastPageRef.current = origin;
      setViewedIdx(origin);
      scrollY.value = withSpring(0, { damping: 60, stiffness: 180, mass: 1.2 });
    }
    // Above threshold: let pagingEnabled snap to the nearest page naturally
  }, []);

  // Tap a stop dot/pill → jump pager to that stop's page
  const handleStopPress = useCallback((stopId: string) => {
    const idx = stops.findIndex(s => s.id === stopId);
    if (idx >= 0) {
      pagerRef.current?.scrollTo({ x: idx * SCREEN_WIDTH, animated: true });
      setViewedIdx(idx);
      scrollY.value = withSpring(0, { damping: 60, stiffness: 180, mass: 1.2 });
    }
  }, [stops]);

  // During swipe — update strip at the 50% crossover point
  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.max(0, Math.min(
      Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH),
      stops.length - 1,
    ));
    if (idx !== lastPageRef.current) {
      lastPageRef.current = idx;
      setViewedIdx(idx);
    }
  }, [stops.length]);

  // After swipe settles — ensure final position is locked in, reset hero
  const handlePageChange = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.max(0, Math.min(
      Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH),
      stops.length - 1,
    ));
    lastPageRef.current = idx;
    setViewedIdx(idx);
    scrollY.value = withSpring(0, { damping: 60, stiffness: 180, mass: 1.2 });
  }, [stops.length]);

  // CTA fades out and collapses as user scrolls — height collapses so the
  // strip slides up rather than leaving empty space behind the invisible card.
  // Height is absent until first onLayout fires (sentinel -1) to avoid clipping.
  const ctaFadeStyle = useAnimatedStyle(() => {
    // Fade leads (0→120px), height follows (40→180px) so the card dissolves
    // before the space closes — feels more intentional, less abrupt.
    const opacity = interpolate(scrollY.value, [0, 120], [1, 0], Extrapolation.CLAMP);
    if (carouselHeight.value < 0) return { opacity };
    return {
      opacity,
      height: interpolate(scrollY.value, [40, 180], [carouselHeight.value, 0], Extrapolation.CLAMP),
      overflow: 'hidden',
    };
  });

  return (
    <View style={styles.container}>
      <HeroLayer
        trip={trip}
        activeStop={activeStop}
        visibleStop={stops[viewedIdx] ?? activeStop}
        scrollY={scrollY}
      />

      {/* Sample CTA carousel — fades and collapses as user scrolls, reappears at top */}
      <Animated.View
        style={ctaFadeStyle}
        onLayout={e => {
          if (carouselHeight.value < 0) carouselHeight.value = e.nativeEvent.layout.height;
        }}
      >
        <SampleCTACarousel />
      </Animated.View>

      {/* Fixed strip — active pill tracks the viewed page, not just the real trip position */}
      <StopsStrip
        stops={stops}
        activeStopId={stops[viewedIdx]?.id ?? null}
        onStopPress={handleStopPress}
      />

      {/* Horizontal pager — one full page per stop */}
      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        scrollEventThrottle={16}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScroll={handleScroll}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handlePageChange}
        showsHorizontalScrollIndicator={false}
        style={styles.pager}
        contentOffset={{ x: initialIdx * SCREEN_WIDTH, y: 0 }}
      >
        {stops.map((stop) => (
          <View key={stop.id} style={styles.page}>
            <Animated.ScrollView
              onScroll={scrollHandler}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              directionalLockEnabled
              contentInsetAdjustmentBehavior="never"
              automaticallyAdjustKeyboardInsets={false}
              refreshControl={
                <RefreshControl
                  refreshing={status === 'loading'}
                  onRefresh={refetch}
                  tintColor={Brand.gold}
                />
              }
            >
              <StopSection
                stop={stop}
                bookings={bookingsByStop[stop.id] ?? []}
                days={itinerary[stop.id] ?? []}
                expandedDayId={expandedDayIds[stop.id] ?? null}
                onDayPress={dayId => handleDayPress(stop.id, dayId)}
                onBookingPress={booking => handleBookingPress(booking, stop)}
                onItemPress={item => handleItemPress(item, stop)}
              />
              <View style={styles.bottomPad} />
            </Animated.ScrollView>
          </View>
        ))}
      </ScrollView>

      <EntityDetailSheet ref={entitySheetRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Core.bg },
  pager:     { flex: 1 },
  page:      { width: SCREEN_WIDTH, flex: 1 },
  bottomPad: { height: 48 },
});
