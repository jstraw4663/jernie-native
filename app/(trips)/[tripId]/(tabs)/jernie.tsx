import React, { useState, useRef } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { DEV_TRIP, DEV_STOPS, DEV_BOOKINGS, DEV_ITINERARY } from '@/src/fixtures/devTrip';
import { getActiveStopId, getAutoExpandDayIndex } from '@/src/domain/trip';
import { getDevNow } from '@/src/utils/devTime';
import { HeroLayer } from '@/src/features/jernie/HeroLayer';
import { CTACardZone } from '@/src/features/jernie/CTACardZone';
import { StopsStrip } from '@/src/features/jernie/StopsStrip';
import { StopSection } from '@/src/features/jernie/StopSection';
import { Core } from '@/src/design/tokens';
import type { Booking } from '@/src/types';

export default function JernieTab() {
  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<string, number>>({});

  const now = getDevNow();
  const activeStopId = getActiveStopId(DEV_STOPS, now);
  const activeStop = DEV_STOPS.find(s => s.id === activeStopId) ?? DEV_STOPS[0];

  const [ctaDismissed, setCtaDismissed] = useState(false);

  const [expandedDayIds, setExpandedDayIds] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(DEV_STOPS.map(s => {
      const days = DEV_ITINERARY[s.id] ?? [];
      const idx = getAutoExpandDayIndex(days, now);
      return [s.id, idx >= 0 ? (days[idx]?.id ?? null) : null];
    }))
  );

  function setExpandedDayId(stopId: string, dayId: string | null) {
    setExpandedDayIds(prev => ({ ...prev, [stopId]: dayId }));
  }

  function bookingsForStop(stopId: string): Booking[] {
    return DEV_BOOKINGS.filter(b => b.stopId === stopId);
  }

  function handleStopPress(stopId: string) {
    const offset = sectionOffsets.current[stopId];
    if (offset !== undefined) {
      scrollRef.current?.scrollTo({ y: offset, animated: true });
    }
  }

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
        <HeroLayer trip={DEV_TRIP} activeStop={activeStop} />

        {/* 1 — always-rendered wrapper keeps stickyHeaderIndices[1] stable when CTA dismissed */}
        <View>
          {!ctaDismissed && (
            <CTACardZone
              trip={DEV_TRIP}
              stops={DEV_STOPS}
              bookings={DEV_BOOKINGS}
              onDismiss={() => setCtaDismissed(true)}
            />
          )}
        </View>

        {/* 2 — stacks below CTA when both are sticky */}
        <StopsStrip
          stops={DEV_STOPS}
          activeStopId={activeStopId}
          onStopPress={handleStopPress}
        />

        {/* 3+ */}
        {DEV_STOPS.map(stop => (
          <StopSection
            key={stop.id}
            stop={stop}
            bookings={bookingsForStop(stop.id)}
            days={DEV_ITINERARY[stop.id] ?? []}
            expandedDayId={expandedDayIds[stop.id] ?? null}
            onDayPress={dayId => setExpandedDayId(stop.id, dayId)}
            onSectionLayout={y => { sectionOffsets.current[stop.id] = y; }}
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
