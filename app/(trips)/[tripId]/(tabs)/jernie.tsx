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
import { bookingBelongsToStop } from '@/src/domain/bookings';
import { getPlaceEnrichment } from '@/src/domain/placeEnrichment';
import { getDevNow } from '@/src/utils/devTime';
import { HeroLayer } from '@/src/features/jernie/HeroLayer';
import { SampleCTACarousel } from '@/src/features/jernie/SampleCTACarousel';
import { StopsStrip } from '@/src/features/jernie/StopsStrip';
import { StopSection } from '@/src/features/jernie/StopSection';
import { EntityDetailSheet } from '@/src/features/jernie/sheets/EntityDetailSheet';
import type { EntityDetailSheetRef } from '@/src/features/jernie/sheets/EntityDetailSheet';
import { StopFormSheet } from '@/src/features/jernie/sheets/StopFormSheet';
import type { StopFormSheetRef } from '@/src/features/jernie/sheets/StopFormSheet';
import { BookingFormSheet } from '@/src/features/jernie/sheets/BookingFormSheet';
import type { BookingFormSheetRef } from '@/src/features/jernie/sheets/BookingFormSheet';
import { CustomItemSheet } from '@/src/features/jernie/sheets/CustomItemSheet';
import type { CustomItemSheetRef } from '@/src/features/jernie/sheets/CustomItemSheet';
import { Brand, Core } from '@/src/design/tokens';
import type { Booking, BookingType, ItineraryItem, StopWithColor } from '@/src/types';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function JernieTab() {
  const { trip, stops, bookings, itinerary, places, enrichment, status, refetch } = useTripContext();

  const now = getDevNow();
  const activeStopId = getActiveStopId(stops, now);
  const activeStop = stops.find(s => s.id === activeStopId) ?? stops[0];

  const initialIdx = Math.max(0, stops.findIndex(s => s.id === activeStopId));
  const [viewedIdx, setViewedIdx] = useState(initialIdx);
  const [editingStop, setEditingStop] = useState<StopWithColor | null>(null);

  const pagerRef      = useRef<ScrollView>(null);
  const lastPageRef   = useRef(initialIdx);
  const originPageRef = useRef(initialIdx); // page index when drag began
  const entitySheetRef = useRef<EntityDetailSheetRef>(null);
  const stopFormSheetRef = useRef<StopFormSheetRef>(null);
  const bookingSheetRef = useRef<BookingFormSheetRef>(null);
  const customItemSheetRef = useRef<CustomItemSheetRef>(null);

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
      stops.map(s => [s.id, bookings.filter((b: Booking) => bookingBelongsToStop(b, s.id))])
    ),
    [stops, bookings],
  );

  const handleDayPress = useCallback(
    (stopId: string, dayId: string | null) =>
      setExpandedDayIds(prev => ({ ...prev, [stopId]: dayId })),
    [],
  );

  const handleBookingPress = useCallback((booking: Booking, stop: StopWithColor) => {
    // Edit closes the detail sheet before opening the form — two modals stacked on top of
    // each other read as a bug, and the user is done with the detail view at that point.
    const onEdit = () => {
      entitySheetRef.current?.dismiss();
      bookingSheetRef.current?.present({ type: booking.type, stopId: stop.id, editingBooking: booking });
    };
    const base = { stopColor: stop.color, stopLabel: stop.city, onEdit };

    if (booking.type === 'hotel')           entitySheetRef.current?.present({ kind: 'hotel', booking, ...base });
    else if (booking.type === 'flight')     entitySheetRef.current?.present({ kind: 'flight', booking, ...base });
    else if (booking.type === 'rental')     entitySheetRef.current?.present({ kind: 'rental', booking, ...base });
    else if (booking.type === 'restaurant') entitySheetRef.current?.present({ kind: 'restaurant', booking, ...base });
  }, []);

  const handleItemPress = useCallback((item: ItineraryItem, stop: StopWithColor) => {
    // Custom items are user-authored free text — they open the editor, not a detail view.
    // The write layer needs the owning day, which is only derivable from the itinerary.
    if (item.type === 'custom') {
      const day = (itinerary[stop.id] ?? []).find(d => d.items.some(i => i.id === item.id));
      if (day) customItemSheetRef.current?.present({ stopId: stop.id, day, editingItem: item });
      return;
    }

    const place = item.placeId ? places.find(p => p.id === item.placeId) : undefined;

    if (place) {
      const kind = place.category === 'hike' ? 'hike' : 'place';
      entitySheetRef.current?.present({
        kind,
        name: place.name,
        stopLabel: stop.city,
        stopColor: stop.color,
        place,
        enrichment: getPlaceEnrichment(enrichment, place),
        // isAdded is trivially true here — an item opened from the itinerary is by
        // definition already in it — so the Add button never renders from this entry point.
        isAdded: true,
      });
      return;
    }

    // No linked place (a handful of free-text items) — preserve the original mock-based behavior.
    const label = item.label ?? '';
    if (item.category === 'restaurant') {
      entitySheetRef.current?.present({ kind: 'place', name: label, stopLabel: stop.city, stopColor: stop.color });
    } else if (item.category === 'hike') {
      entitySheetRef.current?.present({ kind: 'hike', name: label, stopLabel: stop.city, stopColor: stop.color });
    }
  }, [places, enrichment, itinerary]);

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

  // Add and edit share one sheet ref; `editingStop` is what tells them apart, so the add
  // path must clear it first — otherwise the sheet reopens in edit mode from a prior press.
  const handleAddStopPress = useCallback(() => {
    setEditingStop(null);
    stopFormSheetRef.current?.present();
  }, []);

  // Targets the stop the user is *looking at* (the paged `viewedIdx`), not the date-derived
  // `activeStop` — those diverge while paging, and editing should follow the eye.
  const handleEditStopPress = useCallback(() => {
    setEditingStop(stops[viewedIdx] ?? activeStop);
    stopFormSheetRef.current?.present();
  }, [stops, viewedIdx, activeStop]);

  const handleAddBooking = useCallback((stopId: string, type: BookingType) => {
    bookingSheetRef.current?.present({ type, stopId });
  }, []);

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
        onEditStop={handleEditStopPress}
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
        onAddPress={handleAddStopPress}
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
                onAddBooking={type => handleAddBooking(stop.id, type)}
                onAddItineraryItem={() => customItemSheetRef.current?.present({ stopId: stop.id })}
              />
              <View style={styles.bottomPad} />
            </Animated.ScrollView>
          </View>
        ))}
      </ScrollView>

      <EntityDetailSheet ref={entitySheetRef} />
      <StopFormSheet
        ref={stopFormSheetRef}
        tripId={trip.id}
        editingStop={editingStop ?? undefined}
        onSaved={refetch}
      />
      <BookingFormSheet ref={bookingSheetRef} tripId={trip.id} onSaved={refetch} />
      <CustomItemSheet ref={customItemSheetRef} tripId={trip.id} onSaved={refetch} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Core.bg },
  pager:     { flex: 1 },
  page:      { width: SCREEN_WIDTH, flex: 1 },
  bottomPad: { height: 48 },
});
