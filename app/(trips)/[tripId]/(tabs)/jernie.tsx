import React, { useState, useRef, useMemo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedRef,
  scrollTo,
  runOnJS,
  runOnUI,
} from 'react-native-reanimated';
import { createMMKV } from 'react-native-mmkv';
import { useTripContext } from '@/src/contexts/TripContext';
import { getActiveStopId, getAutoExpandDayIndex } from '@/src/domain/trip';
import { getDevNow } from '@/src/utils/devTime';
import { HeroLayer } from '@/src/features/jernie/HeroLayer';
import { CTACardZone } from '@/src/features/jernie/CTACardZone';
import { StopsStrip } from '@/src/features/jernie/StopsStrip';
import { StopSection } from '@/src/features/jernie/StopSection';
import { Core } from '@/src/design/tokens';
import type { Booking } from '@/src/types';

const uiStorage = createMMKV({ id: 'jernie-ui' });

// Approx height of sticky CTA zone + StopsStrip — used for scroll-based stop tracking
const STICKY_HEADER_HEIGHT = 130;

export default function JernieTab() {
  const { trip, stops, bookings, itinerary } = useTripContext();

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const sectionOffsets = useRef<Record<string, number>>({});
  const scrollY = useSharedValue(0);

  const now = getDevNow();
  const activeStopId = getActiveStopId(stops, now);
  const activeStop = stops.find(s => s.id === activeStopId) ?? stops[0];

  const ctaKey = `cta_dismissed_${trip.id}`;
  const [ctaDismissed, setCtaDismissed] = useState(
    () => uiStorage.getBoolean(ctaKey) ?? false,
  );

  const [visibleStopId, setVisibleStopId] = useState<string>(
    activeStopId ?? stops[0]?.id ?? '',
  );
  const visibleStop = stops.find(s => s.id === visibleStopId) ?? stops[0];

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

  const handleDismissCTA = useCallback(() => {
    uiStorage.set(ctaKey, true);
    setCtaDismissed(true);
  }, [ctaKey]);

  const handleDayPress = useCallback(
    (stopId: string, dayId: string | null) =>
      setExpandedDayIds(prev => ({ ...prev, [stopId]: dayId })),
    [],
  );

  const handleSectionLayout = useCallback(
    (stopId: string, y: number) => { sectionOffsets.current[stopId] = y; },
    [],
  );

  const handleStopPress = useCallback((stopId: string) => {
    const offset = sectionOffsets.current[stopId];
    if (offset !== undefined) {
      runOnUI(() => { 'worklet'; scrollTo(scrollRef, 0, offset, true); })();
    }
  }, [scrollRef]);

  function updateVisibleStop(y: number) {
    const offsets = sectionOffsets.current;
    let newId = stops[0]?.id ?? '';
    for (const stop of stops) {
      const offset = offsets[stop.id];
      if (offset !== undefined && y >= offset - STICKY_HEADER_HEIGHT) newId = stop.id;
    }
    setVisibleStopId(prev => (prev === newId ? prev : newId));
  }

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      runOnJS(updateVisibleStop)(event.contentOffset.y);
    },
  });

  return (
    <View style={styles.container}>
      {/* Hero lives outside the ScrollView — stays pinned at top, collapses on scroll */}
      <HeroLayer
        trip={trip}
        activeStop={activeStop}
        visibleStop={visibleStop}
        scrollY={scrollY}
      />

      <Animated.ScrollView
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        stickyHeaderIndices={[0, 1]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustKeyboardInsets={false}
        style={styles.scrollView}
      >
        {/* 0 — always-rendered wrapper keeps stickyHeaderIndices[0] stable when CTA dismissed */}
        <View>
          {!ctaDismissed && (
            <CTACardZone
              trip={trip}
              stops={stops}
              onDismiss={handleDismissCTA}
            />
          )}
        </View>

        {/* 1 — stacks below CTA when both are sticky */}
        <StopsStrip
          stops={stops}
          activeStopId={visibleStopId}
          onStopPress={handleStopPress}
        />

        {/* 2+ — one section per stop */}
        {stops.map(stop => (
          <StopSection
            key={stop.id}
            stop={stop}
            bookings={bookingsByStop[stop.id] ?? []}
            days={itinerary[stop.id] ?? []}
            expandedDayId={expandedDayIds[stop.id] ?? null}
            onDayPress={dayId => handleDayPress(stop.id, dayId)}
            onSectionLayout={y => handleSectionLayout(stop.id, y)}
          />
        ))}

        <View style={styles.bottomPad} />
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Core.bg },
  scrollView: { flex: 1 },
  bottomPad: { height: 48 },
});
