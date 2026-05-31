import React, { useState, useRef, useMemo, useCallback } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
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

export default function JernieTab() {
  const { trip, stops, bookings, itinerary } = useTripContext();

  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<string, number>>({});

  const now = getDevNow();
  const activeStopId = getActiveStopId(stops, now);
  const activeStop = stops.find(s => s.id === activeStopId) ?? stops[0];

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

  const handleSectionLayout = useCallback(
    (stopId: string, y: number) => { sectionOffsets.current[stopId] = y; },
    [],
  );

  const handleStopPress = useCallback((stopId: string) => {
    const offset = sectionOffsets.current[stopId];
    if (offset !== undefined) {
      scrollRef.current?.scrollTo({ y: offset, animated: true });
    }
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        stickyHeaderIndices={[1, 2]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustKeyboardInsets={false}
      >
        {/* 0 — scrolls away */}
        <HeroLayer trip={trip} activeStop={activeStop} />

        {/* 1 — always-rendered wrapper keeps stickyHeaderIndices[1] stable when CTA dismissed */}
        <View>
          {!ctaDismissed && (
            <CTACardZone
              trip={trip}
              stops={stops}
              onDismiss={handleDismissCTA}
            />
          )}
        </View>

        {/* 2 — stacks below CTA when both are sticky */}
        <StopsStrip
          stops={stops}
          activeStopId={activeStopId}
          onStopPress={handleStopPress}
        />

        {/* 3+ */}
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Core.bg },
  bottomPad: { height: 48 },
});
