// The home screen. One vertical scroll, one collapse value, one stop at a time.
//
// Layer order matters and is the whole trick:
//   1. the list        — scrolls under everything
//   2. HomeHeader      — above the list, so content passes beneath the photo, never over it
//   3. StopRail        — above the header, because the rail floats ON the photo at rest
//
// The rail is an overlay rather than a list child, so a collapsing spacer reclaims its space
// as it leaves. Everything animated reads one shared `scrollY`; see home/collapse.ts.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import Animated, {
  Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle,
  useSharedValue, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTripContext } from '@/src/contexts/TripContext';
import { bookingBelongsToStop } from '@/src/domain/bookings';
import { getPlaceEnrichment } from '@/src/domain/placeEnrichment';
import { shouldShowNudge, snoozeMsFor } from '@/src/domain/saveNudge';
import { getActiveStopId } from '@/src/domain/trip';
import { useCollisionSignIn } from '@/src/hooks/useCollisionSignIn';
import { readSnooze, writeSnooze } from '@/src/lib/nudgeSnooze';
import { resolvePhoto } from '@/src/lib/images';
import { Core, Gutter } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { Button } from '@/src/ui';
import { getDevNow } from '@/src/utils/devTime';
import type { Booking, BookingType, ItineraryItem, StopWithColor } from '@/src/types';
import { CtaRow, NUDGE_GLYPH, SETUP_GLYPH } from '@/src/features/jernie/home/CtaRow';
import { DayGroup } from '@/src/features/jernie/home/DayGroup';
import { HERO_MAX, RAIL_TOP, RANGE } from '@/src/features/jernie/home/collapse';
import { HomeHeader } from '@/src/features/jernie/home/HomeHeader';
import { StopRail, type RailStop } from '@/src/features/jernie/home/StopRail';
import { EntityDetailSheet } from '@/src/features/jernie/sheets/EntityDetailSheet';
import type { EntityDetailSheetRef } from '@/src/features/jernie/sheets/EntityDetailSheet';
import { StopFormSheet } from '@/src/features/jernie/sheets/StopFormSheet';
import type { StopFormSheetRef } from '@/src/features/jernie/sheets/StopFormSheet';
import { BookingFormSheet } from '@/src/features/jernie/sheets/BookingFormSheet';
import type { BookingFormSheetRef } from '@/src/features/jernie/sheets/BookingFormSheet';
import { CustomItemSheet } from '@/src/features/jernie/sheets/CustomItemSheet';
import type { CustomItemSheetRef } from '@/src/features/jernie/sheets/CustomItemSheet';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SETUP_KEYS = ['stays', 'flights', 'car', 'restaurants'] as const;
type SetupKey = (typeof SETUP_KEYS)[number];

// Ordered by what generates a gap: somewhere to sleep first, then how you get around, then
// preferences. Matches PromptRow.prompt.md's ordering rule.
const SETUP_BOOKING_TYPE: Record<SetupKey, BookingType> = {
  stays: 'hotel', flights: 'flight', car: 'rental', restaurants: 'restaurant',
};
const SETUP_NOUN: Record<SetupKey, string> = {
  stays: 'somewhere to stay', flights: 'flights', car: 'a rental car', restaurants: 'somewhere to eat',
};

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

function nightsBetween(startIso: string, endIso: string): number {
  const [sy, sm, sd] = startIso.split('-').map(Number);
  const [ey, em, ed] = endIso.split('-').map(Number);
  return Math.max(0, Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86400000));
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function JernieTab() {
  const { trip, stops, bookings, itinerary, places, enrichment, status, refetch } = useTripContext();
  const { status: authStatus, user, anonCreatedAt, signInWithApple } = useAuth();
  const adoptOnCollision = useCollisionSignIn();
  const insets = useSafeAreaInsets();
  const [s, t] = useStyles();

  const now = getDevNow();
  const todayIso = isoOf(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const activeStopId = getActiveStopId(stops, now);
  const initialIdx = Math.max(0, stops.findIndex(st => st.id === activeStopId));
  const [viewedIdx, setViewedIdx] = useState(initialIdx);
  const [editingStop, setEditingStop] = useState<StopWithColor | null>(null);
  const [ctaDismissed, setCtaDismissed] = useState(false);
  const [snoozeTick, setSnoozeTick] = useState(0);

  const visibleStop = stops[viewedIdx] ?? stops[0];

  const entitySheetRef = useRef<EntityDetailSheetRef>(null);
  const stopFormSheetRef = useRef<StopFormSheetRef>(null);
  const bookingSheetRef = useRef<BookingFormSheetRef>(null);
  const customItemSheetRef = useRef<CustomItemSheetRef>(null);

  // The one scroll value. Nothing else animates off anything else.
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler(e => { scrollY.value = e.contentOffset.y; });
  const listRef = useRef<Animated.ScrollView>(null);

  // The rail is an overlay, so the list needs a spacer of the same height to sit below —
  // one that collapses as the rail leaves, or the content is left floating in a hole.
  const railH = useSharedValue(128);
  const [, setRailMeasured] = useState(false);
  const onRailLayout = useCallback((h: number) => {
    if (h > 0 && Math.abs(railH.value - h) > 0.5) {
      railH.value = h;
      setRailMeasured(true);
    }
  }, [railH]);

  const spacer = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [0, RANGE], [railH.value, 0], Extrapolation.CLAMP),
  }));

  // ── Save nudge ────────────────────────────────────────────────────────────
  // Outranks everything else the CTA row could say: an unsaved trip is at risk in every
  // phase, most of all post-trip when it is a memory worth keeping.
  const nudgeLevelDue = useMemo(() => {
    if (!user) return null;
    return shouldShowNudge({
      status: authStatus,
      anonCreatedAt,
      snoozedUntil: readSnooze(user.uid),
      // `now`, not Date.now() — this screen's dev time-travel otherwise cannot exercise the
      // 7/21-day branches on device without waiting a real week.
      now: now.getTime(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, user, anonCreatedAt, snoozeTick]);

  const [nudgeBusy, setNudgeBusy] = useState(false);
  const [nudgeError, setNudgeError] = useState<string | null>(null);

  // Four outcomes, all handled. A bare `void signInWithApple()` here would discard collision,
  // error and cancellation alike, aimed at the user with the most to lose.
  const handleSaveNudge = async () => {
    if (nudgeBusy || !user) return;
    setNudgeBusy(true);
    setNudgeError(null);
    const outcome = await signInWithApple();
    if (outcome.ok) { setNudgeBusy(false); return; }
    if (outcome.reason === 'cancelled') { setNudgeBusy(false); return; }
    if (outcome.reason === 'credential-already-in-use') {
      const result = await adoptOnCollision(outcome.signIn);
      setNudgeBusy(false);
      if (result.status === 'untrusted') {
        setNudgeError("Can't verify your trips yet — try again in a moment.");
      } else if (result.status === 'failed') {
        setNudgeError("Couldn't sign in. Try again.");
      } else if (result.status === 'signed-in' && result.failed > 0) {
        setNudgeError('Signed in. Your trip is still copying across — it will appear shortly.');
      }
      return;
    }
    setNudgeBusy(false);
    setNudgeError(outcome.message);
  };

  // ── What the one CTA row says ─────────────────────────────────────────────
  // Priority, not phase: nudge, then setup, then (Session 5) a gap, then nothing.
  const unmetSetup = SETUP_KEYS.filter(k => trip.setupIntent?.[k] && !bookings.some(b => b.type === SETUP_BOOKING_TYPE[k]));

  const cta = nudgeLevelDue && user
    ? {
        Glyph: NUDGE_GLYPH,
        title: 'Save your trip',
        sub: nudgeError ?? "It only lives on this phone until you sign in.",
        action: 'Save',
        tone: 'warning' as const,
        busy: nudgeBusy,
        onPress: () => { void handleSaveNudge(); },
        onDismiss: () => {
          writeSnooze(user.uid, Date.now() + snoozeMsFor(nudgeLevelDue));
          setSnoozeTick(n => n + 1);
        },
        testID: 'save-nudge-card',
        actionTestID: 'save-nudge-save',
        dismissTestID: 'save-nudge-dismiss',
      }
    : unmetSetup.length > 0 && !ctaDismissed
      ? {
          Glyph: SETUP_GLYPH[unmetSetup[0]],
          title: `You still need ${SETUP_NOUN[unmetSetup[0]]}`,
          sub: unmetSetup.length === 1
            ? 'The last thing you said you\'d sort out'
            : `${unmetSetup.length} things left from your setup`,
          action: 'Add',
          tone: 'warning' as const,
          busy: false,
          onPress: () => bookingSheetRef.current?.present({ type: SETUP_BOOKING_TYPE[unmetSetup[0]], stopId: visibleStop.id }),
          onDismiss: () => setCtaDismissed(true),
          testID: 'cta-setup',
          actionTestID: `setup-row-${unmetSetup[0]}`,
          dismissTestID: 'cta-dismiss',
        }
      : null;

  // ── Header copy ───────────────────────────────────────────────────────────
  const tripStart = stops[0]?.dates.start;
  const tripEnd = stops[stops.length - 1]?.dates.end;
  const kicker = useMemo(() => {
    if (!tripStart || !tripEnd) return 'YOUR TRIP';
    const total = nightsBetween(tripStart, tripEnd);
    if (todayIso < tripStart) {
      const away = nightsBetween(todayIso, tripStart);
      return away === 1 ? 'TOMORROW' : `IN ${away} DAYS`;
    }
    if (todayIso > tripEnd) return 'TRIP COMPLETE';
    return `DAY ${nightsBetween(tripStart, todayIso) + 1} OF ${total + 1}`;
  }, [tripStart, tripEnd, todayIso]);

  const heroSub = tripStart && tripEnd
    ? `${shortDate(tripStart)} – ${shortDate(tripEnd)} · ${stops.length} stop${stops.length === 1 ? '' : 's'}`
    : `${stops.length} stop${stops.length === 1 ? '' : 's'}`;

  // ── Rail data ─────────────────────────────────────────────────────────────
  const railStops: RailStop[] = useMemo(() => stops.map((stop, i) => {
    const stopBookings = bookings.filter((b: Booking) => bookingBelongsToStop(b, stop.id));
    const plans = (itinerary[stop.id] ?? []).reduce((n, d) => n + d.items.length, 0);
    const hasStay = stopBookings.some(b => b.type === 'hotel');
    const nights = nightsBetween(stop.dates.start, stop.dates.end);
    return {
      id: stop.id,
      name: stop.city,
      dates: `${shortDate(stop.dates.start)} – ${shortDate(stop.dates.end)} · ${nights} night${nights === 1 ? '' : 's'}`,
      kicker: `Stop ${i + 1} of ${stops.length}`,
      // Amber is unfinished, never broken. No stay booked is the one thing worth saying here
      // until Session 5 can derive the real gap set.
      status: hasStay ? 'Stay booked' : 'Nowhere to sleep',
      statusTone: hasStay ? 'accent' : 'warning',
      count: `${plans} plan${plans === 1 ? '' : 's'}`,
      photo: resolvePhoto({ kind: 'stop', stop, places }, { enrichment }),
    };
  }), [stops, bookings, itinerary, places, enrichment]);

  const heroPhoto = railStops[viewedIdx]?.photo;

  // Switching stop returns the header to full height — the new stop's photo is the point of
  // switching, and landing mid-collapse would hide it.
  const handleSelectStop = useCallback((i: number) => {
    setViewedIdx(i);
    listRef.current?.scrollTo({ y: 0, animated: true });
    scrollY.value = withTiming(0, { duration: 220 });
  }, [scrollY]);

  const handleItemPress = useCallback((item: ItineraryItem) => {
    const stop = visibleStop;
    if (item.type === 'custom') {
      const day = (itinerary[stop.id] ?? []).find(d => d.items.some(i => i.id === item.id));
      if (day) customItemSheetRef.current?.present({ stopId: stop.id, day, editingItem: item });
      return;
    }
    const place = item.placeId ? places.find(p => p.id === item.placeId) : undefined;
    if (place) {
      entitySheetRef.current?.present({
        kind: place.category === 'hike' ? 'hike' : 'place',
        name: place.name,
        stopLabel: stop.city,
        stopColor: stop.color,
        place,
        enrichment: getPlaceEnrichment(enrichment, place),
        // Trivially true — an item opened from the itinerary is already in it.
        isAdded: true,
      });
      return;
    }
    const label = item.label ?? '';
    if (item.category === 'restaurant') {
      entitySheetRef.current?.present({ kind: 'place', name: label, stopLabel: stop.city, stopColor: stop.color });
    } else if (item.category === 'hike') {
      entitySheetRef.current?.present({ kind: 'hike', name: label, stopLabel: stop.city, stopColor: stop.color });
    }
  }, [visibleStop, itinerary, places, enrichment]);

  const days = itinerary[visibleStop.id] ?? [];

  return (
    <View style={s.screen}>
      <Animated.ScrollView
        ref={listRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={status === 'loading'} onRefresh={refetch} tintColor={Core.action} progressViewOffset={HERO_MAX} />
        }
      >
        <Animated.View style={spacer} />

        {cta ? <CtaRow {...cta} /> : null}

        {days.map(day => (
          <DayGroup
            key={day.id}
            day={day}
            places={places}
            bookings={bookings}
            enrichment={enrichment}
            todayIso={todayIso}
            nowMinutes={nowMinutes}
            onItemPress={handleItemPress}
          />
        ))}

        <View style={s.addZone}>
          {/* The primitive, not a bespoke bordered Text — the gate for this session is that
              the screen re-implements no row or card. */}
          <Button
            testID="add-to-stop"
            label={`Add something to ${visibleStop.city}`}
            variant="secondary"
            size="md"
            icon={<PlusIcon size={15} color={t.textMuted} />}
            onPress={() => customItemSheetRef.current?.present({ stopId: visibleStop.id })}
          />
        </View>
      </Animated.ScrollView>

      <HomeHeader
        kicker={kicker}
        title={trip.name}
        sub={heroSub}
        photo={heroPhoto}
        stopName={visibleStop.city}
        stopDates={railStops[viewedIdx]?.dates ?? ''}
        stopPhoto={heroPhoto}
        stopCount={stops.length}
        stopIndex={viewedIdx}
        insetTop={insets.top}
        scrollY={scrollY}
        onStopPress={handleSelectStop}
      />

      <StopRail
        stops={railStops}
        index={viewedIdx}
        scrollY={scrollY}
        onSelect={handleSelectStop}
        onLayoutHeight={onRailLayout}
      />

      <EntityDetailSheet ref={entitySheetRef} />
      <StopFormSheet ref={stopFormSheetRef} tripId={trip.id} editingStop={editingStop ?? undefined} onSaved={refetch} />
      <BookingFormSheet ref={bookingSheetRef} tripId={trip.id} onSaved={refetch} />
      <CustomItemSheet ref={customItemSheetRef} tripId={trip.id} onSaved={refetch} />
    </View>
  );
}

const useStyles = createThemedStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.surface },
  // Content starts where the rail does; the collapsing spacer covers the rail's own height.
  content: { paddingTop: RAIL_TOP, paddingBottom: 28 },

  addZone: { paddingHorizontal: Gutter, paddingTop: 22 },
}));
