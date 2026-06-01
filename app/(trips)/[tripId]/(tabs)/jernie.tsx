import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, RefreshControl,
  Dimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { createMMKV } from 'react-native-mmkv';
import { useTripContext } from '@/src/contexts/TripContext';
import { getActiveStopId, getAutoExpandDayIndex } from '@/src/domain/trip';
import { getDevNow } from '@/src/utils/devTime';
import { HeroLayer } from '@/src/features/jernie/HeroLayer';
import { CTACardZone } from '@/src/features/jernie/CTACardZone';
import { StopsStrip } from '@/src/features/jernie/StopsStrip';
import { StopSection } from '@/src/features/jernie/StopSection';
import { Brand, Core } from '@/src/design/tokens';
import type { Booking } from '@/src/types';

const uiStorage = createMMKV({ id: 'jernie-ui' });
const SCREEN_WIDTH = Dimensions.get('window').width;

export default function JernieTab() {
  const { trip, stops, bookings, itinerary, status, refetch } = useTripContext();

  const now = getDevNow();
  const activeStopId = getActiveStopId(stops, now);
  const activeStop = stops.find(s => s.id === activeStopId) ?? stops[0];

  const initialIdx = Math.max(0, stops.findIndex(s => s.id === activeStopId));
  const [viewedIdx, setViewedIdx] = useState(initialIdx);

  const pagerRef    = useRef<ScrollView>(null);
  const lastPageRef = useRef(initialIdx);

  const ctaKey = `cta_dismissed_${trip.id}`;
  const [ctaDismissed, setCtaDismissed] = useState(
    () => uiStorage.getBoolean(ctaKey) ?? false,
  );

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

  // Tap a stop dot/pill → jump pager to that stop's page
  const handleStopPress = useCallback((stopId: string) => {
    const idx = stops.findIndex(s => s.id === stopId);
    if (idx >= 0) {
      pagerRef.current?.scrollTo({ x: idx * SCREEN_WIDTH, animated: true });
      setViewedIdx(idx);
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

  // After swipe settles — ensure final position is locked in
  const handlePageChange = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.max(0, Math.min(
      Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH),
      stops.length - 1,
    ));
    lastPageRef.current = idx;
    setViewedIdx(idx);
  }, [stops.length]);

  return (
    <View style={styles.container}>
      <HeroLayer
        trip={trip}
        activeStop={activeStop}
        visibleStop={stops[viewedIdx] ?? activeStop}
      />

      {!ctaDismissed && (
        <CTACardZone
          trip={trip}
          stops={stops}
          onDismiss={handleDismissCTA}
        />
      )}

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
        onScroll={handleScroll}
        onMomentumScrollEnd={handlePageChange}
        showsHorizontalScrollIndicator={false}
        style={styles.pager}
        contentOffset={{ x: initialIdx * SCREEN_WIDTH, y: 0 }}
      >
        {stops.map(stop => (
          <View key={stop.id} style={styles.page}>
            <ScrollView
              showsVerticalScrollIndicator={false}
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
              />
              <View style={styles.bottomPad} />
            </ScrollView>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Core.bg },
  pager:     { flex: 1 },
  page:      { width: SCREEN_WIDTH, flex: 1 },
  bottomPad: { height: 48 },
});
