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
import { DEV_TRIP, DEV_STOPS, DEV_BOOKINGS, DEV_ITINERARY } from '@/src/fixtures/devTrip';
import { getActiveStopId, getAutoExpandDayIndex } from '@/src/domain/trip';
import { getDevNow } from '@/src/utils/devTime';
import { HeroLayer } from '@/src/features/jernie/HeroLayer';
import { CTACardZone } from '@/src/features/jernie/CTACardZone';
import { StopsStrip } from '@/src/features/jernie/StopsStrip';
import { StopSection } from '@/src/features/jernie/StopSection';
import { Core } from '@/src/design/tokens';

const uiStorage = createMMKV({ id: 'jernie-ui' });

// Approximate combined height of sticky CTA zone + StopsStrip.
// Used to trigger stop-pill highlight when a section header enters the viewport.
const STICKY_HEADER_HEIGHT = 130;

export default function JernieTab() {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const sectionOffsets = useRef<Record<string, number>>({});
  const scrollY = useSharedValue(0);

  const now = getDevNow();
  const activeStopId = getActiveStopId(DEV_STOPS, now);
  const activeStop = DEV_STOPS.find(s => s.id === activeStopId) ?? DEV_STOPS[0];

  const ctaKey = `cta_dismissed_${DEV_TRIP.id}`;
  const [ctaDismissed, setCtaDismissed] = useState(
    () => uiStorage.getBoolean(ctaKey) ?? false
  );

  const [visibleStopId, setVisibleStopId] = useState<string>(
    activeStopId ?? DEV_STOPS[0].id
  );
  const visibleStop = DEV_STOPS.find(s => s.id === visibleStopId) ?? DEV_STOPS[0];

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

  const bookingsByStop = useMemo(
    () => Object.fromEntries(
      DEV_STOPS.map(s => [s.id, DEV_BOOKINGS.filter(b => b.stopId === s.id)])
    ),
    [] // fixture data is module-level constant — no deps needed
  );

  const handleStopPress = useCallback((stopId: string) => {
    const offset = sectionOffsets.current[stopId];
    if (offset !== undefined) {
      runOnUI(() => {
        'worklet';
        scrollTo(scrollRef, 0, offset, true);
      })();
    }
  }, [scrollRef]);

  const handleDayPress = useCallback((stopId: string, dayId: string | null) => {
    setExpandedDayId(stopId, dayId);
  }, []);

  const handleSectionLayout = useCallback((stopId: string, y: number) => {
    sectionOffsets.current[stopId] = y;
  }, []);

  // Runs on JS thread via runOnJS — determines which stop section is visible
  function updateVisibleStop(y: number) {
    const offsets = sectionOffsets.current;
    let newId = DEV_STOPS[0].id;
    for (const stop of DEV_STOPS) {
      const offset = offsets[stop.id];
      if (offset !== undefined && y >= offset - STICKY_HEADER_HEIGHT) {
        newId = stop.id;
      }
    }
    // Guard prevents re-render on every scroll event when stop hasn't changed
    setVisibleStopId(prev => (prev === newId ? prev : newId));
  }

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      runOnJS(updateVisibleStop)(event.contentOffset.y);
    },
  });

  function handleDismissCTA() {
    uiStorage.set(ctaKey, true);
    setCtaDismissed(true);
  }

  return (
    <View style={styles.container}>
      {/* Hero lives outside the ScrollView so it stays at the top of the screen */}
      <HeroLayer
        trip={DEV_TRIP}
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
        {/* 0 — always-rendered wrapper keeps stickyHeaderIndices[0] stable */}
        <View>
          {!ctaDismissed && (
            <CTACardZone
              trip={DEV_TRIP}
              stops={DEV_STOPS}
              onDismiss={handleDismissCTA}
            />
          )}
        </View>

        {/* 1 — stacks below CTA when both are sticky */}
        <StopsStrip
          stops={DEV_STOPS}
          activeStopId={visibleStopId}
          onStopPress={handleStopPress}
        />

        {/* 2+ — one section per stop */}
        {DEV_STOPS.map(stop => (
          <StopSection
            key={stop.id}
            stop={stop}
            bookings={bookingsByStop[stop.id] ?? []}
            days={DEV_ITINERARY[stop.id] ?? []}
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
