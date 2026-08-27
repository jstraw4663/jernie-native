// The home screen. One vertical scroll, one collapse value, and the whole trip in one timeline.
//
// Layer order matters and is the whole trick:
//   1. the list        — scrolls under everything
//   2. HomeHeader      — above the list, so content passes beneath the photo, never over it
//   3. StopRail        — above the header, because the rail floats ON the photo at rest
//   4. StopMorph       — above both: the active card, stretching into the collapsed bar
//
// The rail is an overlay rather than a list child, so a collapsing spacer reclaims its space
// as it leaves. Every structural header animation reads one shared `scrollY`; the itinerary
// also tracks its measured native offset so automated navigation can preserve that value.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, RefreshControl, View } from 'react-native';
import type { AppStateStatus, LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation, Easing, Extrapolation, interpolate, runOnJS, useAnimatedScrollHandler,
  useAnimatedStyle, useDerivedValue, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowsDownUpIcon } from 'phosphor-react-native/src/icons/ArrowsDownUp';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { TrashIcon } from 'phosphor-react-native/src/icons/Trash';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTripContext } from '@/src/contexts/TripContext';
import { bookingBelongsToStop } from '@/src/domain/bookings';
import {
  itineraryMoveForDrop, moveItineraryItemBetweenDays as moveItemsBetweenDays,
  reorderItineraryItems, type ItineraryItemDrop,
} from '@/src/domain/itinerary';
import { shouldShowNudge, snoozeMsFor } from '@/src/domain/saveNudge';
import { buildItineraryTimeline } from '@/src/domain/itineraryTimeline';
import type { TimelineBandKey, TimelineEntry } from '@/src/domain/itineraryTimeline';
import { readJernieViewport, writeJernieViewport } from '@/src/lib/jernieViewport';
import { getActiveStopId } from '@/src/domain/trip';
import { useCollisionSignIn } from '@/src/hooks/useCollisionSignIn';
import { useUserProfile } from '@/src/hooks/useUserProfile';
import { openMapsApp } from '@/src/lib/maps';
import { removeBooking } from '@/src/lib/bookingWrites';
import {
  ItineraryMoveWriteError, moveItineraryItemBetweenDays, removeItineraryItemById,
  reorderItineraryDayItems,
} from '@/src/lib/itineraryWrites';
import { readSnooze, writeSnooze } from '@/src/lib/nudgeSnooze';
import { resolvePhoto } from '@/src/lib/images';
import { Animation, Core, Gutter, Spacing } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { Button, tap } from '@/src/ui';
import { getDevNow } from '@/src/utils/devTime';
import type { Booking, BookingType, ItineraryDay, StopWithColor } from '@/src/types';
import { CtaRow, NUDGE_GLYPH, SETUP_GLYPH } from '@/src/features/jernie/home/CtaRow';
import {
  HERO_MAX, QUICK_RETURN_DURATION, QUICK_RETURN_VELOCITY, RAIL_TOP, RANGE, heroMin, spacerMin,
} from '@/src/features/jernie/home/collapse';
import { HomeHeader } from '@/src/features/jernie/home/HomeHeader';
import { StopMorph } from '@/src/features/jernie/home/StopMorph';
import { StopRail, type RailStop } from '@/src/features/jernie/home/StopRail';
import { DetailSheet, useDetailSheet } from '@/src/features/jernie/sheets/detail';
import {
  createTimelineDragCoordinator, ItineraryDateRail, ItineraryUndoToast, TimelineDayView,
  TimelineDragOverlay, TIMELINE_DAY_BAR_HEIGHT,
} from '@/src/features/jernie/itinerary';
import type {
  TimelineDayPlacement, TimelineDragOverlayState, TimelineDragPlacement,
  TimelineDragPreview, TimelineDropRequest,
} from '@/src/features/jernie/itinerary';
import { StopFormSheet } from '@/src/features/jernie/sheets/StopFormSheet';
import type { StopFormSheetRef } from '@/src/features/jernie/sheets/StopFormSheet';
import { BookingFormSheet } from '@/src/features/jernie/sheets/BookingFormSheet';
import type { BookingFormSheetRef } from '@/src/features/jernie/sheets/BookingFormSheet';
import { CustomItemSheet } from '@/src/features/jernie/sheets/CustomItemSheet';
import type { CustomItemSheetRef } from '@/src/features/jernie/sheets/CustomItemSheet';
import { MapAppSheet } from '@/src/features/jernie/sheets/MapAppSheet';
import type { MapAppSheetRef } from '@/src/features/jernie/sheets/MapAppSheet';
import { DecisionSheet, DecisionSheetError } from '@/src/features/jernie/sheets/DecisionSheet';
import type { DecisionSheetRef } from '@/src/features/jernie/sheets/DecisionSheet';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TOWARD_TOP_VELOCITY_SIGN = Platform.OS === 'android' ? 1 : -1;

const SETUP_KEYS = ['stays', 'flights', 'car', 'restaurants'] as const;
type SetupKey = (typeof SETUP_KEYS)[number];

type TimelineRemoval =
  | { kind: 'booking'; bookingId: string }
  | { kind: 'item'; stopId: string; dayId: string; itemId: string };

interface UndoNotice {
  id: number;
  title: string;
  removal: TimelineRemoval;
  busy: boolean;
  failed: boolean;
}

interface OptimisticTimelineMove {
  base: Record<string, ItineraryDay[]>;
  value: Record<string, ItineraryDay[]>;
  itemId: string;
}

function isTimelineRemoval(value: unknown): value is TimelineRemoval {
  if (!value || typeof value !== 'object' || !('kind' in value)) return false;
  if (value.kind === 'booking') return 'bookingId' in value && typeof value.bookingId === 'string';
  return value.kind === 'item'
    && 'stopId' in value && typeof value.stopId === 'string'
    && 'dayId' in value && typeof value.dayId === 'string'
    && 'itemId' in value && typeof value.itemId === 'string';
}

function removalStillExists(
  removal: TimelineRemoval,
  bookings: Booking[],
  itinerary: Record<string, ItineraryDay[]>,
): boolean {
  if (removal.kind === 'booking') {
    return bookings.some(booking => booking.id === removal.bookingId)
      || Object.values(itinerary).some(days => days.some(day =>
        day.items.some(item => item.bookingId === removal.bookingId)));
  }
  return (itinerary[removal.stopId] ?? []).some(day =>
    day.id === removal.dayId && day.items.some(item => item.id === removal.itemId));
}

function hidesTimelineItem(
  removal: TimelineRemoval,
  stopId: string,
  day: ItineraryDay,
  item: ItineraryDay['items'][number],
): boolean {
  return removal.kind === 'booking'
    ? item.bookingId === removal.bookingId
    : stopId === removal.stopId && day.id === removal.dayId && item.id === removal.itemId;
}

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

function isoDayDistance(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.abs(Math.round(
    (Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000,
  ));
}

function moveFailureMessage(cause: unknown): string {
  if (cause instanceof ItineraryMoveWriteError) {
    if (cause.reason === 'item-missing') {
      return 'This item is no longer in the itinerary. Refresh and try again.';
    }
    if (cause.reason === 'destination-missing') {
      return 'That itinerary day is no longer available. Refresh and choose another day.';
    }
    return "Jernie couldn't finish saving the move. Your original itinerary is unchanged.";
  }
  const code = cause && typeof cause === 'object' && 'code' in cause
    ? String(cause.code).toLowerCase()
    : '';
  if (code.includes('permission')) {
    return 'You no longer have permission to change this trip.';
  }
  if (code.includes('network') || code.includes('unavailable') || code.includes('disconnected')) {
    return "Jernie couldn't reach the trip. Check your connection and try again.";
  }
  return "Jernie couldn't save this move. Your original itinerary is unchanged.";
}

function headerBottomAt(collapseY: number, insetTop: number, railHeight: number): number {
  const progress = Math.max(0, Math.min(1, collapseY / RANGE));
  const expanded = RAIL_TOP + railHeight;
  return expanded + (heroMin(insetTop) - expanded) * progress;
}

function timelineOriginAt(collapseY: number, insetTop: number, railHeight: number): number {
  const progress = Math.max(0, Math.min(1, collapseY / RANGE));
  const expanded = RAIL_TOP + railHeight;
  return expanded + (RAIL_TOP + spacerMin(insetTop) - expanded) * progress;
}

export default function JernieTab() {
  const { trip, stops, bookings, itinerary, places, enrichment, status, refetch } = useTripContext();
  const { status: authStatus, user, anonCreatedAt, signInWithApple } = useAuth();
  const profile = useUserProfile(user?.uid ?? null);
  const adoptOnCollision = useCollisionSignIn();
  const insets = useSafeAreaInsets();
  const [s, t] = useStyles();
  const [undoNotice, setUndoNotice] = useState<UndoNotice | null>(null);
  const [committedRemovals, setCommittedRemovals] = useState<TimelineRemoval[]>([]);
  const [optimisticMove, setOptimisticMove] = useState<OptimisticTimelineMove | null>(null);
  const [moveBusy, setMoveBusy] = useState(false);
  const [timelineDragCoordinator] = useState(createTimelineDragCoordinator);
  const [timelineDragOverlay, setTimelineDragOverlay] = useState<TimelineDragOverlayState | null>(null);
  const [timelineSettleActive, setTimelineSettleActive] = useState(false);
  const undoIdRef = useRef(0);
  const timelineSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fast Refresh can preserve a pre-migration restore snapshot in local component state.
  // Drop it before the user can retry it through the delayed-commit handler.
  useEffect(() => {
    if (undoNotice && !isTimelineRemoval(undoNotice.removal)) setUndoNotice(null);
  }, [undoNotice]);

  const now = getDevNow();
  const todayIso = isoOf(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const hiddenRemovals = useMemo(() => [
    ...committedRemovals,
    ...(undoNotice && !undoNotice.failed ? [undoNotice.removal] : []),
  ], [committedRemovals, undoNotice]);
  const timelineBookings = useMemo(() => bookings.filter(booking =>
    !hiddenRemovals.some(removal =>
      removal.kind === 'booking' && removal.bookingId === booking.id)),
  [bookings, hiddenRemovals]);
  const timelineItinerary = useMemo(() => {
    if (hiddenRemovals.length === 0) return itinerary;
    return Object.fromEntries(Object.entries(itinerary).map(([stopId, days]) => [
      stopId,
      days.map(day => ({
        ...day,
        items: day.items.filter(item =>
          !hiddenRemovals.some(removal => hidesTimelineItem(removal, stopId, day, item))),
      })),
    ]));
  }, [hiddenRemovals, itinerary]);

  const renderedItinerary = useMemo(() => {
    return optimisticMove?.base === itinerary ? optimisticMove.value : timelineItinerary;
  }, [itinerary, optimisticMove, timelineItinerary]);

  useEffect(() => {
    if (optimisticMove && optimisticMove.base !== itinerary) setOptimisticMove(null);
  }, [itinerary, optimisticMove]);

  const timeline = useMemo(() => buildItineraryTimeline({
    stops, bookings: timelineBookings, itinerary: renderedItinerary, places, enrichment,
    now: { todayIso, minutes: nowMinutes },
  }), [stops, timelineBookings, renderedItinerary, places, enrichment, todayIso, nowMinutes]);
  const dragPlacements = useMemo(() => {
    const result: Record<string, TimelineDragPlacement> = {};
    for (const [stopId, days] of Object.entries(renderedItinerary)) {
      for (const day of days) {
        for (const item of day.items) {
          result[`item:${item.id}`] = { stopId, dayId: day.id, itemId: item.id };
        }
      }
    }
    return result;
  }, [renderedItinerary]);
  const dragDayPlacements = useMemo(() => {
    const result: Record<string, TimelineDayPlacement[]> = {};
    for (const timelineDay of timeline.days) {
      result[timelineDay.dateIso] = timelineDay.segments.flatMap(segment => {
        const itineraryDay = renderedItinerary[segment.stopId]?.find(
          candidate => candidate.dateIso === timelineDay.dateIso,
        );
        return itineraryDay ? [{ stopId: segment.stopId, dayId: itineraryDay.id }] : [];
      });
    }
    return result;
  }, [renderedItinerary, timeline.days]);
  const stopColors = useMemo(
    () => Object.fromEntries(stops.map(stop => [stop.id, stop.color])),
    [stops],
  );

  const activeStopId = getActiveStopId(stops, now);
  const firstTimelineDay = timeline.days[0];
  const [restoredViewport] = useState(() => readJernieViewport(trip.id));
  const restoredTimelineDay = restoredViewport
    ? timeline.days.find(day => day.dateIso === restoredViewport.dateIso)
    : undefined;
  const initialTimelineDay = restoredTimelineDay ?? firstTimelineDay;
  const restoredStopId = restoredTimelineDay?.segments.some(
    segment => segment.stopId === restoredViewport?.stopId,
  ) ? restoredViewport?.stopId : undefined;
  const firstTimelineStopId = restoredStopId
    ?? initialTimelineDay?.segments[initialTimelineDay.segments.length - 1]?.stopId;
  const initialIdx = Math.max(0, stops.findIndex(
    stop => stop.id === (firstTimelineStopId ?? activeStopId),
  ));
  const [viewedIdx, setViewedIdx] = useState(initialIdx);
  // Read inside handleSelectStop so the callback can stay identity-stable — it is passed to
  // the rail, which re-creates its scroll handlers whenever it changes.
  const viewedIdxRef = useRef(initialIdx);
  const [editingStop, setEditingStop] = useState<StopWithColor | null>(null);
  const [ctaDismissed, setCtaDismissed] = useState(false);
  const [snoozeTick, setSnoozeTick] = useState(0);
  const initialDateIso = initialTimelineDay?.dateIso ?? todayIso;
  const initialContentY = restoredTimelineDay ? Math.max(0, restoredViewport?.contentY ?? 0) : 0;
  const initialCollapseY = restoredTimelineDay
    ? Math.max(0, Math.min(RANGE, restoredViewport?.collapseY ?? 0))
    : 0;
  const [selectedDateIso, setSelectedDateIso] = useState(initialDateIso);
  const selectedDateRef = useRef(initialDateIso);


  const visibleStop = stops[viewedIdx] ?? stops[0];

  const detail = useDetailSheet();
  const stopFormSheetRef = useRef<StopFormSheetRef>(null);
  const bookingSheetRef = useRef<BookingFormSheetRef>(null);
  const customItemSheetRef = useRef<CustomItemSheetRef>(null);
  const mapAppSheetRef = useRef<MapAppSheetRef>(null);
  // Two instances of one sheet, not one shared instance: a queued move must never overwrite
  // a remove confirmation that is already on screen.
  const removeEntrySheetRef = useRef<DecisionSheetRef>(null);
  const moveEntrySheetRef = useRef<DecisionSheetRef>(null);

  // The one structural scroll value. Hero, stop rail and stop morph still read only this.
  // `contentScrollY` is the native list position used for measured itinerary navigation;
  // keeping the two coordinates distinct lets an automated date jump preserve the header's
  // exact visual state instead of collapsing it as a side effect.
  const scrollY = useSharedValue(initialCollapseY);
  const railTransitionActive = useSharedValue(0);
  const contentScrollY = useSharedValue(initialContentY);
  const timelineDragRowTop = useSharedValue(0);
  const timelineDragIndicatorTop = useSharedValue(0);
  const screenWindowY = useSharedValue(0);
  const collapseOriginY = useSharedValue(initialContentY - initialCollapseY);
  // Once the collapse reaches its endpoint, reverse scrolling moves the itinerary beneath the
  // pinned header. It is released only by the deliberate quick-return gesture (or trip-top CTA).
  const collapseLocked = useSharedValue(initialCollapseY >= RANGE - 0.5 ? 1 : 0);
  const boundaryReturnArmed = useSharedValue(0);
  const quickReturnActive = useSharedValue(0);
  const programmaticTargetY = useSharedValue(-1);
  const screenRef = useRef<View>(null);
  const listRef = useRef<Animated.ScrollView>(null);
  const dayOffsetsRef = useRef<Record<string, number>>({});
  const stopBoundaryOffsetsRef = useRef<Record<string, number>>({});
  const lastScrollYRef = useRef(initialContentY);
  const lastCollapseYRef = useRef(initialCollapseY);
  const programmaticDateRef = useRef<string | null>(null);
  const programmaticStopIdRef = useRef<string | null>(null);
  const programmaticTargetYRef = useRef<number | null>(null);
  const pendingDateRef = useRef<string | null>(null);
  const pendingStopIdRef = useRef<string | null>(null);
  const navigationSequenceRef = useRef(0);
  const restoringViewportRef = useRef(Boolean(restoredTimelineDay));
  const interruptedNavigationRef = useRef<{ dateIso: string; stopId: string | null } | null>(null);
  const contentHeightRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const railHeightRef = useRef(128);
  const dateRailHeightRef = useRef(0);
  const dateRailY = useSharedValue(0);
  const dateRailH = useSharedValue(0);
  const bottomRunwayH = useSharedValue(0);
  const dragAutoScrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dragAutoScrollDirectionRef = useRef<-1 | 0 | 1>(0);
  const dragLastAbsoluteYRef = useRef(0);

  const stopDragAutoScroll = useCallback(() => {
    dragAutoScrollDirectionRef.current = 0;
    if (dragAutoScrollTimerRef.current) clearInterval(dragAutoScrollTimerRef.current);
    dragAutoScrollTimerRef.current = null;
  }, []);

  const handleTimelineDragPosition = useCallback((absoluteY: number) => {
    dragLastAbsoluteYRef.current = absoluteY;
    const viewportHeight = viewportHeightRef.current;
    if (viewportHeight <= 0) return;
    const topEdge = Math.max(insets.top + 130, viewportHeight * 0.2);
    const bottomEdge = viewportHeight - Math.max(insets.bottom + 72, viewportHeight * 0.12);
    const direction: -1 | 0 | 1 = absoluteY < topEdge ? -1 : absoluteY > bottomEdge ? 1 : 0;
    dragAutoScrollDirectionRef.current = direction;
    if (direction === 0) {
      stopDragAutoScroll();
      return;
    }
    if (dragAutoScrollTimerRef.current) return;
    dragAutoScrollTimerRef.current = setInterval(() => {
      const currentDirection = dragAutoScrollDirectionRef.current;
      if (currentDirection === 0) return;
      const maximum = Math.max(0, contentHeightRef.current - viewportHeightRef.current);
      const requested = contentScrollY.value + currentDirection * 14;
      const next = Math.max(0, Math.min(requested, maximum));
      if (Math.abs(next - contentScrollY.value) < 0.5) return;
      listRef.current?.scrollTo({ y: next, animated: false });
      setTimeout(() => {
        Object.values(timelineDragCoordinator.remeasure).forEach(remeasure => remeasure());
        timelineDragCoordinator.activeUpdate?.(dragLastAbsoluteYRef.current);
      }, 0);
    }, 40);
  }, [contentScrollY, insets.bottom, insets.top, stopDragAutoScroll, timelineDragCoordinator]);

  const handleTimelineDragPreview = useCallback((preview: TimelineDragPreview | null) => {
    if (!preview) stopDragAutoScroll();
  }, [stopDragAutoScroll]);

  const handleTimelineDragOverlay = useCallback((overlay: TimelineDragOverlayState | null) => {
    setTimelineDragOverlay(current => {
      if (!overlay || !current) return overlay;
      if (
        current.entry.id === overlay.entry.id
        && current.height === overlay.height
        && current.previewTimeLabel === overlay.previewTimeLabel
        && current.placementLabel === overlay.placementLabel
      ) return current;
      return overlay;
    });
  }, []);

  const beginTimelineSettle = useCallback(() => {
    if (timelineSettleTimerRef.current) clearTimeout(timelineSettleTimerRef.current);
    setTimelineSettleActive(true);
    timelineSettleTimerRef.current = setTimeout(() => {
      timelineSettleTimerRef.current = null;
      setTimelineSettleActive(false);
    }, Animation.duration.slow);
  }, []);

  const handleScreenLayout = useCallback(() => {
    screenRef.current?.measureInWindow((_x, y) => { screenWindowY.value = y; });
  }, [screenWindowY]);

  useEffect(() => stopDragAutoScroll, [stopDragAutoScroll]);
  useEffect(() => () => {
    if (timelineSettleTimerRef.current) clearTimeout(timelineSettleTimerRef.current);
  }, []);

  const adoptTimelineDay = useCallback((dateIso: string, preferredStopId?: string) => {
    const day = timeline.days.find(candidate => candidate.dateIso === dateIso);
    if (!day) return;
    if (selectedDateRef.current !== dateIso) {
      selectedDateRef.current = dateIso;
      setSelectedDateIso(dateIso);
    }
    const segmentStopIds = day.segments.map(segment => segment.stopId);
    const currentStopId = stops[viewedIdxRef.current]?.id;
    // A handoff date belongs to both stops. Keep the user's explicit stop when supplied;
    // otherwise retain the current stop while it remains part of the date. This prevents a
    // Portland → Bar Harbor day from flipping the hero back and forth at the day boundary.
    const stopId = preferredStopId && segmentStopIds.includes(preferredStopId)
      ? preferredStopId
      : currentStopId && segmentStopIds.includes(currentStopId)
        ? currentStopId
        : day.segments[day.segments.length - 1]?.stopId;
    const stopIndex = stopId ? stops.findIndex(stop => stop.id === stopId) : -1;
    if (stopIndex >= 0 && stopIndex !== viewedIdxRef.current) {
      viewedIdxRef.current = stopIndex;
      setViewedIdx(stopIndex);
    }
  }, [timeline.days, stops]);

  useEffect(() => {
    // A cache/live refresh rebuilds `timeline.days` even when its dates and native layout are
    // unchanged. Keep measurements for surviving dates; clearing them here makes the next
    // scroll event see no measured day and incorrectly adopt the trip's first day.
    const currentDates = new Set(timeline.days.map(day => day.dateIso));
    dayOffsetsRef.current = Object.fromEntries(
      Object.entries(dayOffsetsRef.current).filter(([dateIso]) => currentDates.has(dateIso)),
    );
    stopBoundaryOffsetsRef.current = Object.fromEntries(
      Object.entries(stopBoundaryOffsetsRef.current).filter(([dateIso]) => currentDates.has(dateIso)),
    );
    if (timeline.days.some(day => day.dateIso === selectedDateRef.current)) return;
    restoringViewportRef.current = false;
    const fallback = timeline.days[0]?.dateIso;
    if (fallback) adoptTimelineDay(fallback);
  }, [timeline.days, adoptTimelineDay]);

  const syncTimelineFromScroll = useCallback((y: number, collapseY: number) => {
    lastScrollYRef.current = y;
    lastCollapseYRef.current = collapseY;
    // A restored native offset is authoritative until the selected day's new layout has
    // been measured. Letting the fallback path run before then would overwrite the saved
    // calendar selection with day one while the screen is still mounting.
    if (restoringViewportRef.current) return;


    // A requested date whose layout is still pending owns the calendar just as firmly as an
    // animation with a numeric target. Layout will restart the latest request once measured.
    if (pendingDateRef.current) return;

    // A calendar/stop jump owns selection until it reaches the measured target. Otherwise
    // the dates crossed during the native animation briefly steal selection and make the
    // rail and hero flash backward before landing on the requested stop.
    const programmaticDate = programmaticDateRef.current;
    const programmaticStopId = programmaticStopIdRef.current;
    const targetY = programmaticTargetYRef.current;
    if (programmaticDate && targetY !== null) {
      if (Math.abs(y - targetY) <= 1.5) {
        programmaticDateRef.current = null;
        programmaticStopIdRef.current = null;
        programmaticTargetYRef.current = null;
        programmaticTargetY.value = -1;
        collapseOriginY.value = y - collapseY;
        adoptTimelineDay(programmaticDate, programmaticStopId ?? undefined);
      }
      return;
    }

    const firstDay = timeline.days[0];
    if (!firstDay) return;
    const timelineViewportLine = y
      + headerBottomAt(collapseY, insets.top, railHeightRef.current)
      + dateRailHeightRef.current
      + 1
      - timelineOriginAt(collapseY, insets.top, railHeightRef.current);
    let visibleDay = firstDay;
    for (const candidate of timeline.days) {
      const offset = dayOffsetsRef.current[candidate.dateIso];
      if (offset === undefined) continue;
      if (offset <= timelineViewportLine) visibleDay = candidate;
      else break;
    }
    const selectedDay = timeline.days.find(day => day.dateIso === selectedDateRef.current);
    const selectedDayIndex = selectedDay ? timeline.days.indexOf(selectedDay) : -1;
    const visibleDayIndex = timeline.days.indexOf(visibleDay);
    const selectedDayOffset = selectedDay
      ? dayOffsetsRef.current[selectedDay.dateIso]
      : undefined;
    const visibleDayOffset = dayOffsetsRef.current[visibleDay.dateIso];
    // Native momentum can correct by a fraction of a point at the exact collision. Keep
    // ownership with the current date until the new header has crossed a real 4pt boundary;
    // the UI-thread push-away remains pixel-exact, but React state cannot chatter at the seam.
    if (
      selectedDay
      && selectedDayIndex >= 0
      && visibleDayIndex > selectedDayIndex
      && visibleDayOffset !== undefined
      && timelineViewportLine < visibleDayOffset + Spacing.xs
    ) {
      visibleDay = selectedDay;
    } else if (
      selectedDay
      && selectedDayIndex >= 0
      && visibleDayIndex < selectedDayIndex
      && selectedDayOffset !== undefined
      && timelineViewportLine > selectedDayOffset - Spacing.xs
    ) {
      visibleDay = selectedDay;
    }
    const dayOffset = dayOffsetsRef.current[visibleDay.dateIso];
    const boundaryOffset = stopBoundaryOffsetsRef.current[visibleDay.dateIso];
    const transition = visibleDay.transition;
    let preferredStopId: string | undefined;
    if (transition && dayOffset !== undefined && boundaryOffset !== undefined) {
      const boundaryY = dayOffset + boundaryOffset;
      // The day bar occupies the first row below the date rail. Ownership changes when the
      // measured handoff marker passes beneath that row, not merely when its date becomes
      // active. A small deadband means a resting finger can hover around the marker without
      // making the stop card chatter between its two stops.
      const ownershipLine = timelineViewportLine + TIMELINE_DAY_BAR_HEIGHT;
      const currentStopId = stops[viewedIdxRef.current]?.id;
      if (currentStopId === transition.fromStopId) {
        preferredStopId = ownershipLine >= boundaryY + Spacing.md
          ? transition.toStopId
          : transition.fromStopId;
      } else if (currentStopId === transition.toStopId) {
        preferredStopId = ownershipLine <= boundaryY - Spacing.md
          ? transition.fromStopId
          : transition.toStopId;
      } else {
        preferredStopId = ownershipLine < boundaryY
          ? transition.fromStopId
          : transition.toStopId;
      }
    }
    adoptTimelineDay(visibleDay.dateIso, preferredStopId);
  }, [timeline.days, stops, insets.top, adoptTimelineDay, collapseOriginY, programmaticTargetY]);

  const cancelProgrammaticNavigation = useCallback(() => {
    navigationSequenceRef.current += 1;
    programmaticDateRef.current = null;
    programmaticStopIdRef.current = null;
    programmaticTargetYRef.current = null;
    pendingDateRef.current = null;
    pendingStopIdRef.current = null;
  }, []);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y;
      contentScrollY.value = y;
      if (programmaticTargetY.value < 0 && quickReturnActive.value === 0) {
        if (collapseLocked.value === 1) {
          if (y <= 0.5) {
            // At the absolute beginning there is no earlier itinerary left to reveal. Hand
            // the remaining pull to the hero: iOS negative overscroll now expands it directly,
            // while Android completes the return when this drag ends.
            collapseLocked.value = 0;
            boundaryReturnArmed.value = 1;
            collapseOriginY.value = -RANGE;
          } else {
            // Slow reverse scrolling must remain possible with the compact header. Moving the
            // origin with the list pins the one structural collapse value at its endpoint.
            scrollY.value = RANGE;
            collapseOriginY.value = y - RANGE;
          }
        } else {
          const nextCollapseY = Math.max(0, Math.min(RANGE, y - collapseOriginY.value));
          scrollY.value = nextCollapseY;
          if (nextCollapseY >= RANGE - 0.5) {
            scrollY.value = RANGE;
            collapseLocked.value = 1;
            boundaryReturnArmed.value = 0;
            collapseOriginY.value = y - RANGE;
          }
        }
      }
      const headerAtRest = scrollY.value <= 0.5 || scrollY.value >= RANGE - 0.5;
      if (
        quickReturnActive.value === 0
        && (programmaticTargetY.value >= 0 || (headerAtRest && y >= 0))
      ) {
        runOnJS(syncTimelineFromScroll)(y, scrollY.value);
      }
    },
    onBeginDrag: () => {
      // A finger always wins, including while the requested day's measurement is pending.
      // Re-anchor at the interruption point so taking over cannot move the hero by a frame.
      const interruptedQuickReturn = quickReturnActive.value === 1;
      cancelAnimation(scrollY);
      quickReturnActive.value = 0;
      boundaryReturnArmed.value = 0;
      collapseOriginY.value = contentScrollY.value - scrollY.value;
      if (interruptedQuickReturn) {
        collapseLocked.value = scrollY.value >= RANGE - 0.5 ? 1 : 0;
      }
      programmaticTargetY.value = -1;
      runOnJS(cancelProgrammaticNavigation)();
    },
    onEndDrag: (event) => {
      if (programmaticTargetY.value >= 0) return;

      // Android exposes finger velocity; iOS exposes content velocity. Normalize both to a
      // positive number when the itinerary is being flicked back toward its beginning.
      const nativeVelocityY = event.velocity?.y ?? 0;
      const towardTopVelocity = nativeVelocityY * TOWARD_TOP_VELOCITY_SIGN;
      const reachedTopBoundary = boundaryReturnArmed.value === 1;
      if (!reachedTopBoundary && (
        collapseLocked.value !== 1 || towardTopVelocity < QUICK_RETURN_VELOCITY
      )) {
        runOnJS(syncTimelineFromScroll)(contentScrollY.value, scrollY.value);
        return;
      }

      boundaryReturnArmed.value = 0;
      collapseLocked.value = 0;
      quickReturnActive.value = 1;
      scrollY.value = withTiming(0, {
        duration: QUICK_RETURN_DURATION,
        easing: Easing.out(Easing.cubic),
      }, finished => {
        if (!finished) return;
        quickReturnActive.value = 0;
        collapseOriginY.value = Math.max(0, contentScrollY.value);
        runOnJS(syncTimelineFromScroll)(contentScrollY.value, 0);
      });
    },
  });

  const targetYForDate = useCallback((dateIso: string): number | null => {
    const offset = dayOffsetsRef.current[dateIso];
    if (offset === undefined || dateRailHeightRef.current <= 0) return null;
    const headerBottom = headerBottomAt(
      lastCollapseYRef.current,
      insets.top,
      railHeightRef.current,
    );
    const absoluteOffset = timelineOriginAt(
      lastCollapseYRef.current,
      insets.top,
      railHeightRef.current,
    ) + offset;
    const requested = Math.max(0, absoluteOffset - headerBottom - dateRailHeightRef.current);
    const maximum = Math.max(0, contentHeightRef.current - viewportHeightRef.current);
    return contentHeightRef.current > 0 && viewportHeightRef.current > 0
      ? Math.min(requested, maximum)
      : requested;
  }, [insets.top]);

  const persistViewport = useCallback((alignSelectedDate = false) => {
    const dateIso = selectedDateRef.current;
    if (!timeline.days.some(day => day.dateIso === dateIso)) return;
    const dateTargetY = targetYForDate(dateIso);
    const contentY = alignSelectedDate && dateTargetY !== null
      ? dateTargetY
      : Math.max(0, lastScrollYRef.current);
    writeJernieViewport(trip.id, {
      dateIso,
      stopId: stops[viewedIdxRef.current]?.id ?? null,
      contentY,
      dayDeltaY: alignSelectedDate || dateTargetY === null ? 0 : contentY - dateTargetY,
      collapseY: Math.max(0, Math.min(RANGE, lastCollapseYRef.current)),
    });
  }, [stops, targetYForDate, timeline.days, trip.id]);

  const finishViewportRestore = useCallback(() => {
    if (!restoringViewportRef.current || !restoredViewport) return;
    const dateIso = selectedDateRef.current;
    if (
      dayOffsetsRef.current[dateIso] === undefined
      || dateRailHeightRef.current <= 0
      || contentHeightRef.current <= 0
      || viewportHeightRef.current <= 0
    ) return;
    const dateTargetY = targetYForDate(dateIso);
    if (dateTargetY === null) return;

    const maximum = Math.max(0, contentHeightRef.current - viewportHeightRef.current);
    const targetY = Math.max(0, Math.min(maximum, dateTargetY + restoredViewport.dayDeltaY));
    restoringViewportRef.current = false;
    lastScrollYRef.current = targetY;
    lastCollapseYRef.current = initialCollapseY;
    contentScrollY.value = targetY;
    scrollY.value = initialCollapseY;
    collapseOriginY.value = targetY - initialCollapseY;
    collapseLocked.value = initialCollapseY >= RANGE - 0.5 ? 1 : 0;
    boundaryReturnArmed.value = 0;
    quickReturnActive.value = 0;
    listRef.current?.scrollTo({ y: targetY, animated: false });
    requestAnimationFrame(() => syncTimelineFromScroll(targetY, initialCollapseY));
  }, [
    boundaryReturnArmed, collapseLocked, collapseOriginY, contentScrollY, initialCollapseY,
    quickReturnActive, restoredViewport, scrollY, syncTimelineFromScroll, targetYForDate,
  ]);

  const scrollToDate = useCallback((dateIso: string, preferredStopId?: string) => {
    // Every request supersedes its predecessor immediately, including the brief state where
    // a requested day's layout is not available yet. Otherwise an older queued frame can
    // start after the new tap and split calendar ownership from the vertical list.
    const sequence = navigationSequenceRef.current + 1;
    navigationSequenceRef.current = sequence;
    programmaticDateRef.current = null;
    programmaticStopIdRef.current = null;
    programmaticTargetYRef.current = null;
    programmaticTargetY.value = -1;
    pendingDateRef.current = null;
    pendingStopIdRef.current = null;
    collapseOriginY.value = lastScrollYRef.current - lastCollapseYRef.current;
    listRef.current?.scrollTo({ y: lastScrollYRef.current, animated: false });

    adoptTimelineDay(dateIso, preferredStopId);
    const stableStopId = stops[viewedIdxRef.current]?.id;
    const targetY = targetYForDate(dateIso);
    if (targetY === null) {
      pendingDateRef.current = dateIso;
      pendingStopIdRef.current = stableStopId ?? null;
      return;
    }

    if (Math.abs(lastScrollYRef.current - targetY) <= 1.5) {
      collapseOriginY.value = targetY - lastCollapseYRef.current;
      return;
    }

    // Native animated scrolling supplies the platform's continuous curve. Locking the
    // collapse coordinate for its duration means only the itinerary moves; the hero, trip
    // title and stop bar retain their exact current height and crop.
    programmaticDateRef.current = dateIso;
    programmaticStopIdRef.current = stableStopId ?? null;
    programmaticTargetYRef.current = targetY;
    programmaticTargetY.value = targetY;
    collapseOriginY.value = targetY - lastCollapseYRef.current;
    // Stop any live finger momentum at its exact current offset, then begin the requested
    // native animation on the next frame. Without this handoff, the old momentum-end event
    // can arrive after the date tap and prematurely release the new navigation lock.
    requestAnimationFrame(() => {
      if (navigationSequenceRef.current !== sequence) return;
      listRef.current?.scrollTo({ y: targetY, animated: true });
    });
  }, [adoptTimelineDay, collapseOriginY, programmaticTargetY, stops, targetYForDate]);

  const finishProgrammaticNavigation = useCallback(() => {
    const targetY = programmaticTargetYRef.current;
    if (targetY === null || Math.abs(lastScrollYRef.current - targetY) > 3) return;
    const targetDate = programmaticDateRef.current;
    const targetStopId = programmaticStopIdRef.current;
    programmaticDateRef.current = null;
    programmaticStopIdRef.current = null;
    programmaticTargetYRef.current = null;
    programmaticTargetY.value = -1;
    collapseOriginY.value = lastScrollYRef.current - lastCollapseYRef.current;
    if (targetDate) adoptTimelineDay(targetDate, targetStopId ?? undefined);
    else syncTimelineFromScroll(lastScrollYRef.current, lastCollapseYRef.current);
  }, [adoptTimelineDay, collapseOriginY, programmaticTargetY, syncTimelineFromScroll]);
  useEffect(() => {
    let previousState: AppStateStatus = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === previousState) return;
      if (nextState !== 'active') {
        const interruptedDate = programmaticDateRef.current ?? pendingDateRef.current;
        if (interruptedDate && !interruptedNavigationRef.current) {
          interruptedNavigationRef.current = {
            dateIso: selectedDateRef.current,
            stopId: stops[viewedIdxRef.current]?.id ?? null,
          };
          cancelProgrammaticNavigation();
          programmaticTargetY.value = -1;
        }
        persistViewport(Boolean(interruptedNavigationRef.current));
      } else if (previousState !== 'active') {
        const interrupted = interruptedNavigationRef.current;
        interruptedNavigationRef.current = null;
        if (interrupted) {
          requestAnimationFrame(() => scrollToDate(
            interrupted.dateIso,
            interrupted.stopId ?? undefined,
          ));
        } else {
          syncTimelineFromScroll(lastScrollYRef.current, lastCollapseYRef.current);
        }
      }
      previousState = nextState;
    });
    return () => {
      persistViewport(Boolean(interruptedNavigationRef.current));
      subscription.remove();
    };
  }, [
    cancelProgrammaticNavigation, persistViewport, programmaticTargetY, scrollToDate, stops,
    syncTimelineFromScroll,
  ]);


  const scrollToTripTop = useCallback(() => {
    cancelProgrammaticNavigation();
    cancelAnimation(scrollY);
    quickReturnActive.value = 0;
    boundaryReturnArmed.value = 0;
    collapseLocked.value = 0;
    programmaticTargetY.value = -1;
    // Returning to the trip top is the one automated move that deliberately restores the
    // expanded hero. Because the native offset drives the same old 0→RANGE curve, it still
    // expands continuously rather than snapping open.
    collapseOriginY.value = 0;
    listRef.current?.scrollTo({ y: 0, animated: true });
  }, [
    boundaryReturnArmed, cancelProgrammaticNavigation, collapseLocked, collapseOriginY,
    programmaticTargetY, quickReturnActive, scrollY,
  ]);

  // The rail is an overlay, so the list needs a spacer of the same height to sit below —
  // one that collapses as the rail leaves, or the content is left floating in a hole.
  const railH = useSharedValue(128);
  const [, setRailMeasured] = useState(false);
  const onRailLayout = useCallback((h: number) => {
    if (h > 0) railHeightRef.current = h;
    if (h > 0 && Math.abs(railH.value - h) > 0.5) {
      railH.value = h;
      setRailMeasured(true);
    }
  }, [railH]);

  // Not to zero. The collapsed header keeps a strip of photo and the trip name now, so a
  // spacer that vanished would park the first card 70px behind the bar. `spacerMin` is the
  // height that lands it exactly on the header's bottom edge at y = RANGE; the card's own
  // paddingTop supplies the gap. See collapse.ts.
  const contentRest = spacerMin(insets.top);
  const collapsedHeaderBottom = heroMin(insets.top);
  const timelineOriginY = useDerivedValue(() => RAIL_TOP + interpolate(
    scrollY.value,
    [0, RANGE],
    [railH.value, contentRest],
    Extrapolation.CLAMP,
  ));
  const spacer = useAnimatedStyle(() => ({
    // This changes only when the rail is measured. Hero motion must not animate layout:
    // moving the complete timeline with a transform keeps sticky rows on the UI thread.
    height: railH.value,
  }));
  const timelineShift = useAnimatedStyle(() => ({
    transform: [{
      translateY: timelineOriginY.value - (RAIL_TOP + railH.value),
    }],
  }));

  const pinnedHeaderBottom = useDerivedValue(() => interpolate(
    scrollY.value,
    [0, RANGE],
    [RAIL_TOP + railH.value, collapsedHeaderBottom],
    Extrapolation.CLAMP,
  ));
  const stickyDayTop = useDerivedValue(() => pinnedHeaderBottom.value + dateRailH.value);
  const pinnedDateRail = useAnimatedStyle(() => {
    const naturalTop = timelineOriginY.value + dateRailY.value - contentScrollY.value;
    return {
      transform: [{ translateY: Math.max(0, pinnedHeaderBottom.value - naturalTop) }],
    };
  });
  const headerContentMask = useAnimatedStyle(() => {
    const heroBottom = interpolate(
      scrollY.value,
      [0, RANGE],
      [HERO_MAX, collapsedHeaderBottom],
      Extrapolation.CLAMP,
    );
    const railBottom = interpolate(
      scrollY.value,
      [0, RANGE],
      [RAIL_TOP + railH.value, collapsedHeaderBottom],
      Extrapolation.CLAMP,
    );
    return {
      top: heroBottom,
      height: Math.max(0, railBottom - heroBottom),
    };
  });

  // Short final days still need enough scrollable tail to place their day bar beneath the
  // pinned calendar. This is the exact missing amount, measured from the current content;
  // it avoids both target clamping and a permanently oversized blank footer.
  const bottomRunway = useAnimatedStyle(() => ({ height: bottomRunwayH.value }));
  const updateBottomRunway = useCallback(() => {
    const lastDay = timeline.days[timeline.days.length - 1];
    const lastDayY = lastDay ? dayOffsetsRef.current[lastDay.dateIso] : undefined;
    const viewportHeight = viewportHeightRef.current;
    const contentHeight = contentHeightRef.current;
    const dateRailHeight = dateRailHeightRef.current;
    if (lastDayY === undefined || viewportHeight <= 0 || contentHeight <= 0 || dateRailHeight <= 0) return;

    const baseContentHeight = Math.max(0, contentHeight - bottomRunwayH.value);
    const requiredContentHeight = timelineOriginAt(
      lastCollapseYRef.current,
      insets.top,
      railHeightRef.current,
    ) + lastDayY
      + viewportHeight
      - heroMin(insets.top)
      - dateRailHeight;
    const next = Math.max(0, requiredContentHeight - baseContentHeight);
    if (Math.abs(bottomRunwayH.value - next) > 0.5) bottomRunwayH.value = next;
  }, [bottomRunwayH, insets.top, timeline.days]);

  const handleDateRailLayout = useCallback((event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    dateRailY.value = y;
    dateRailH.value = height;
    dateRailHeightRef.current = height;
    updateBottomRunway();
    if (restoringViewportRef.current) {
      finishViewportRestore();
      return;
    }
    const pendingDate = pendingDateRef.current;
    const pendingStopId = pendingStopIdRef.current;
    if (pendingDate) scrollToDate(pendingDate, pendingStopId ?? undefined);
    else syncTimelineFromScroll(lastScrollYRef.current, lastCollapseYRef.current);
  }, [
    dateRailH, dateRailY, finishViewportRestore, scrollToDate, syncTimelineFromScroll,
    updateBottomRunway,
  ]);

  const handleListLayout = useCallback((event: LayoutChangeEvent) => {
    viewportHeightRef.current = event.nativeEvent.layout.height;
    updateBottomRunway();
    finishViewportRestore();
  }, [finishViewportRestore, updateBottomRunway]);

  const handleContentSizeChange = useCallback((_width: number, height: number) => {
    contentHeightRef.current = height;
    updateBottomRunway();
    finishViewportRestore();
  }, [finishViewportRestore, updateBottomRunway]);

  const handleTimelineDayLayout = useCallback((
    dateIso: string,
    event: LayoutChangeEvent,
  ) => {
    dayOffsetsRef.current[dateIso] = event.nativeEvent.layout.y;
    updateBottomRunway();
    finishViewportRestore();
    if (restoringViewportRef.current) return;
    if (pendingDateRef.current === dateIso) {
      scrollToDate(dateIso, pendingStopIdRef.current ?? undefined);
    } else {
      syncTimelineFromScroll(lastScrollYRef.current, lastCollapseYRef.current);
    }
  }, [
    finishViewportRestore, scrollToDate, syncTimelineFromScroll,
    updateBottomRunway,
  ]);

  const handleStopBoundaryLayout = useCallback((dateIso: string, offsetY: number) => {
    stopBoundaryOffsetsRef.current[dateIso] = offsetY;
    syncTimelineFromScroll(lastScrollYRef.current, lastCollapseYRef.current);
  }, [syncTimelineFromScroll]);

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

  // Stop taps now navigate the chronology. Repeating the active stop aligns its visible day,
  // then returns to the trip top when it is already aligned.
  const handleSelectStop = useCallback((i: number) => {
    const stop = stops[i];
    if (!stop) return;
    const currentDay = timeline.days.find(day => day.dateIso === selectedDateRef.current);
    const targetDay = i === viewedIdxRef.current && currentDay
      ? currentDay
      : timeline.days.find(day => {
          const segment = day.segments[day.segments.length - 1];
          return segment?.stopId === stop.id;
        });
    const targetDateIso = targetDay?.dateIso;
    const targetY = targetDateIso ? targetYForDate(targetDateIso) : null;
    const alreadyAligned = targetY !== null && Math.abs(lastScrollYRef.current - targetY) < 12;

    tap();
    if (i === viewedIdxRef.current && alreadyAligned) {
      scrollToTripTop();
      return;
    }
    viewedIdxRef.current = i;
    setViewedIdx(i);
    if (targetDateIso) scrollToDate(targetDateIso, stop.id);
    else scrollToTripTop();
  }, [stops, timeline.days, scrollToDate, scrollToTripTop, targetYForDate]);

  const handleEntryPress = useCallback((entry: TimelineEntry) => {
    const source = entry.source;
    if (source.kind === 'custom') {
      const day = (itinerary[entry.stopId] ?? []).find(candidate => candidate.dateIso === entry.dateIso);
      const item = day?.items.find(candidate => candidate.id === source.itemId);
      if (day && item) {
        customItemSheetRef.current?.present({ stopId: entry.stopId, day, editingItem: item });
      }
      return;
    }
    if (source.kind === 'place') {
      const place = places.find(candidate => candidate.id === source.placeId);
      if (place) detail.openPlace(place, { isAdded: true });
      return;
    }
    const booking = bookings.find(candidate => candidate.id === source.bookingId);
    if (booking) {
      detail.openBooking(booking, {
        onEdit: () => bookingSheetRef.current?.present({
          type: booking.type, stopId: booking.stopId, editingBooking: booking,
        }),
      });
    }
  }, [itinerary, places, bookings, detail]);

  const handleEntryNavigate = useCallback(async (entry: TimelineEntry) => {
    const address = entry.address?.trim();
    if (!address) return;
    if (profile.preferredMapsApp) {
      const opened = await openMapsApp(profile.preferredMapsApp, address);
      if (opened) return;
    }
    mapAppSheetRef.current?.present({ address });
  }, [profile.preferredMapsApp]);

  const persistTimelineMove = useCallback(async (
    nextItinerary: Record<string, ItineraryDay[]>,
    itemId: string,
    write: () => Promise<void>,
  ) => {
    setMoveBusy(true);
    setOptimisticMove({ base: itinerary, value: nextItinerary, itemId });
    try {
      await write();
      refetch();
    } catch (error) {
      setOptimisticMove(current => current?.itemId === itemId ? null : current);
      throw error;
    } finally {
      setMoveBusy(false);
    }
  }, [itinerary, refetch]);

  const handleEntryDrop = useCallback((request: TimelineDropRequest) => {
    const sameDay = request.placement.stopId === request.destination.stopId
      && request.placement.dayId === request.destination.dayId;
    if (
      sameDay
      &&
      request.targetItemId === request.placement.itemId
      && request.time === undefined
    ) return;
    const sourceDays = renderedItinerary[request.placement.stopId];
    const sourceDay = sourceDays?.find(candidate => candidate.id === request.placement.dayId);
    const destinationDays = renderedItinerary[request.destination.stopId];
    const destinationDay = destinationDays?.find(candidate => candidate.id === request.destination.dayId);
    if (!sourceDays || !sourceDay || !destinationDays || !destinationDay) {
      refetch();
      return;
    }
    const drop: ItineraryItemDrop = {
      itemId: request.placement.itemId,
      targetItemId: request.targetItemId,
      afterTarget: request.afterTarget,
      time: request.time,
    };

    let nextItinerary: Record<string, ItineraryDay[]>;
    let write: () => Promise<void>;
    if (sameDay) {
      const move = itineraryMoveForDrop(sourceDay.items, drop);
      const movedItems = reorderItineraryItems(sourceDay.items, move);
      const unchanged = movedItems.length === sourceDay.items.length
        && movedItems.every((item, index) => (
          item.id === sourceDay.items[index]?.id
          && item.order === sourceDay.items[index]?.order
          && item.time === sourceDay.items[index]?.time
        ));
      if (unchanged) return;
      nextItinerary = {
        ...renderedItinerary,
        [request.placement.stopId]: sourceDays.map(candidate => candidate.id === sourceDay.id
          ? { ...candidate, items: movedItems }
          : candidate),
      };
      write = () => reorderItineraryDayItems(
        trip.id, request.placement.stopId, request.placement.dayId, move,
      );
    } else {
      const moved = moveItemsBetweenDays(sourceDay.items, destinationDay.items, drop);
      if (request.placement.stopId === request.destination.stopId) {
        nextItinerary = {
          ...renderedItinerary,
          [request.placement.stopId]: sourceDays.map(candidate => {
            if (candidate.id === sourceDay.id) return { ...candidate, items: moved.sourceItems };
            if (candidate.id === destinationDay.id) return { ...candidate, items: moved.destinationItems };
            return candidate;
          }),
        };
      } else {
        nextItinerary = {
          ...renderedItinerary,
          [request.placement.stopId]: sourceDays.map(candidate => candidate.id === sourceDay.id
            ? { ...candidate, items: moved.sourceItems }
            : candidate),
          [request.destination.stopId]: destinationDays.map(candidate => candidate.id === destinationDay.id
            ? { ...candidate, items: moved.destinationItems }
            : candidate),
        };
      }
      write = () => moveItineraryItemBetweenDays(
        trip.id,
        { stopId: request.placement.stopId, dayId: request.placement.dayId },
        { stopId: request.destination.stopId, dayId: request.destination.dayId },
        drop,
      );
    }

    const save = () => {
      beginTimelineSettle();
      return persistTimelineMove(nextItinerary, request.placement.itemId, write);
    };
    const saveWithReadableError = async () => {
      try {
        await save();
      } catch (cause) {
        throw new DecisionSheetError(moveFailureMessage(cause));
      }
    };
    const retryAfterLooseFailure = (cause: unknown) => {
      moveEntrySheetRef.current?.present({
        Glyph: ArrowsDownUpIcon,
        tone: 'action',
        title: `Couldn't move ${request.entry.title}`,
        message: moveFailureMessage(cause),
        cancelLabel: 'Keep it here',
        confirmLabel: 'Try again',
        busyLabel: 'Moving…',
        errorMessage: "Couldn't save this move. Your original itinerary is unchanged.",
        testIdPrefix: 'move-entry',
        onConfirm: saveWithReadableError,
      });
    };

    if (!request.entry.requiresMoveConfirmation) {
      void save().catch(retryAfterLooseFailure);
      return;
    }

    const source = request.entry.source;
    const booking = source.kind === 'booking'
      ? bookings.find(candidate => candidate.id === source.bookingId)
      : undefined;
    let message = 'This plan is locked. Moving it changes its itinerary placement.';
    if (booking?.type === 'restaurant') {
      const original = booking.time ?? request.entry.time.label;
      const party = booking.partySize ? ` with ${booking.partySize} guests` : '';
      message = `It is booked for ${original}${party}. Jernie will not change the reservation — you will need to call ${booking.restaurantName}.`;
    } else if (booking) {
      message = `This is tied to a booked ${booking.type} at ${request.entry.time.label}. Jernie will only move it in your itinerary; the booking details will not change.`;
    }
    moveEntrySheetRef.current?.present({
      Glyph: ArrowsDownUpIcon,
      tone: 'action',
      title: `Move ${request.entry.title} to ${request.destinationLabel}?`,
      message,
      cancelLabel: `Keep ${request.entry.time.label}`,
      confirmLabel: 'Move it',
      busyLabel: 'Moving…',
      errorMessage: "Couldn't save this move. Your original itinerary is unchanged.",
      testIdPrefix: 'move-entry',
      onConfirm: saveWithReadableError,
    });
  }, [beginTimelineSettle, bookings, persistTimelineMove, refetch, renderedItinerary, trip.id]);

  const commitTimelineRemoval = useCallback(async (removal: TimelineRemoval) => {
    if (removal.kind === 'booking') {
      await removeBooking(trip.id, removal.bookingId);
      return;
    }
    await removeItineraryItemById(
      trip.id, removal.stopId, removal.dayId, removal.itemId,
    );
  }, [trip.id]);

  const handleEntryRemove = useCallback((entry: TimelineEntry) => {
    const source = entry.source;
    const booking = source.kind === 'booking'
      ? bookings.find(candidate => candidate.id === source.bookingId)
      : undefined;
    const day = source.kind !== 'booking'
      ? (itinerary[entry.stopId] ?? []).find(candidate =>
          candidate.dateIso === entry.dateIso
          && candidate.items.some(item => item.id === source.itemId))
      : undefined;

    if ((source.kind === 'booking' && !booking) || (source.kind !== 'booking' && !day)) {
      refetch();
      return;
    }

    removeEntrySheetRef.current?.present({
      Glyph: TrashIcon,
      tone: 'destructive',
      title: `Remove ${entry.title}?`,
      message: source.kind === 'booking'
        ? 'This removes the reservation and every itinerary entry linked to it.'
        : 'This removes it from your itinerary.',
      cancelLabel: 'Cancel',
      confirmLabel: 'Remove',
      busyLabel: 'Removing…',
      errorMessage: "Couldn't remove this item. Try again.",
      testIdPrefix: 'remove-entry',
      onConfirm: async () => {
        // There is one visible Undo slot. If the user removes another row during that
        // window, finalize the older operation before queuing the newer one.
        if (undoNotice) {
          setUndoNotice(current => current?.id === undoNotice.id
            ? { ...current, busy: true, failed: false }
            : current);
          try {
            await commitTimelineRemoval(undoNotice.removal);
            setCommittedRemovals(current => [...current, undoNotice.removal]);
            refetch();
          } catch {
            setUndoNotice(current => current?.id === undoNotice.id
              ? { ...current, busy: false, failed: true }
              : current);
            // Name the item that actually failed. Without this the sheet blames the row the
            // user just confirmed, which is still untouched.
            throw new DecisionSheetError(
              `${entry.title} is still here — ${undoNotice.title} could not be removed first. `
              + 'Retry that one from the bar at the bottom.',
            );
          }
        }
        const removal: TimelineRemoval = source.kind === 'booking'
          ? { kind: 'booking', bookingId: booking!.id }
          : { kind: 'item', stopId: entry.stopId, dayId: day!.id, itemId: source.itemId };
        undoIdRef.current += 1;
        setUndoNotice({
          id: undoIdRef.current,
          title: entry.title,
          removal,
          busy: false,
          failed: false,
        });
      },
    });
  }, [bookings, commitTimelineRemoval, itinerary, refetch, undoNotice]);

  const handleCommitRemoval = useCallback(async () => {
    const notice = undoNotice;
    if (!notice || notice.busy) return;
    setUndoNotice(current => current?.id === notice.id
      ? { ...current, busy: true, failed: false }
      : current);
    try {
      await commitTimelineRemoval(notice.removal);
      setCommittedRemovals(current => [...current, notice.removal]);
      refetch();
      setUndoNotice(current => current?.id === notice.id ? null : current);
    } catch {
      setUndoNotice(current => current?.id === notice.id
        ? { ...current, busy: false, failed: true }
        : current);
    }
  }, [commitTimelineRemoval, refetch, undoNotice]);

  const handleUndoRemoval = useCallback(() => {
    if (undoNotice?.failed) {
      void handleCommitRemoval();
      return;
    }
    setUndoNotice(null);
  }, [handleCommitRemoval, undoNotice?.failed]);

  // Two different meanings behind one prop. On a live bar the window expiring *is* the commit;
  // on a failed one the user is abandoning a delete that will not go through, and the row is
  // already back on screen because `hiddenRemovals` excludes failed notices.
  const handleDismissRemoval = useCallback(() => {
    if (undoNotice?.failed) {
      setUndoNotice(null);
      return;
    }
    void handleCommitRemoval();
  }, [handleCommitRemoval, undoNotice?.failed]);

  useEffect(() => {
    if (committedRemovals.length === 0) return;
    const remaining = committedRemovals.filter(removal =>
      removalStillExists(removal, bookings, itinerary));
    if (remaining.length !== committedRemovals.length) setCommittedRemovals(remaining);
  }, [bookings, committedRemovals, itinerary]);

  const handleAddToBand = useCallback((dateIso: string, _band: TimelineBandKey) => {
    const timelineDay = timeline.days.find(day => day.dateIso === dateIso);
    const segment = timelineDay?.segments[timelineDay.segments.length - 1];
    const stopId = segment?.stopId;
    if (!stopId) return;
    const day = (itinerary[stopId] ?? []).find(candidate => candidate.dateIso === dateIso);
    customItemSheetRef.current?.present(day ? { stopId, day } : { stopId });
  }, [timeline.days, itinerary]);

  const todayDateIso = timeline.days[timeline.todayIndex]?.dateIso;
  const showToday = Boolean(
    todayDateIso && isoDayDistance(selectedDateIso, todayDateIso) > 1,
  );

  return (
    <View
      ref={screenRef}
      collapsable={false}
      onLayout={handleScreenLayout}
      style={s.screen}
    >
      <Animated.ScrollView
        ref={listRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={s.content}
        contentOffset={{ x: 0, y: initialContentY }}
        onLayout={handleListLayout}
        onContentSizeChange={handleContentSizeChange}
        onMomentumScrollEnd={finishProgrammaticNavigation}
        refreshControl={
          <RefreshControl refreshing={status === 'loading'} onRefresh={refetch} tintColor={Core.action} progressViewOffset={HERO_MAX} />
        }
      >
        <Animated.View style={spacer} />
        <Animated.View collapsable={false} style={timelineShift}>

        {cta ? (
          <View>
            <CtaRow {...cta} />
          </View>
        ) : null}

        <Animated.View
          style={[s.dateRailLayer, pinnedDateRail]}
          onLayout={handleDateRailLayout}
        >
          <ItineraryDateRail
            days={timeline.days}
            selectedDateIso={selectedDateIso}
            stopColors={stopColors}
            onSelect={scrollToDate}
            showToday={showToday}
            onToday={todayDateIso ? () => scrollToDate(todayDateIso) : undefined}
          />
        </Animated.View>

        {timeline.days.map(day => (
          <TimelineDayView
            key={day.dateIso}
            day={day}
            stopColors={stopColors}
            contentScrollY={contentScrollY}
            contentOriginY={timelineOriginY}
            stickyTop={stickyDayTop}
            onEntryPress={handleEntryPress}
            onEntryNavigate={handleEntryNavigate}
            onEntryRemove={handleEntryRemove}
            dragPlacements={dragPlacements}
            dayPlacements={dragDayPlacements[day.dateIso]}
            dragCoordinator={timelineDragCoordinator}
            onDragPreviewChange={handleTimelineDragPreview}
            dragOverlayTop={timelineDragRowTop}
            dragIndicatorTop={timelineDragIndicatorTop}
            onDragOverlayChange={handleTimelineDragOverlay}
            onDragPositionChange={handleTimelineDragPosition}
            dragEnabled={!moveBusy && !timelineSettleActive}
            settleLayout={timelineSettleActive}
            onEntryDrop={handleEntryDrop}
            onAdd={handleAddToBand}
            onLayout={handleTimelineDayLayout}
            onStopBoundaryLayout={handleStopBoundaryLayout}
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
        <Animated.View style={bottomRunway} />
        </Animated.View>
      </Animated.ScrollView>

      <TimelineDragOverlay
        overlay={timelineDragOverlay}
        rowTop={timelineDragRowTop}
        indicatorTop={timelineDragIndicatorTop}
        screenOriginY={screenWindowY}
      />

      <HomeHeader
        kicker={kicker}
        title={trip.name}
        sub={heroSub}
        photo={heroPhoto}
        insetTop={insets.top}
        scrollY={scrollY}
      />

      {/* The expanded stop card hangs below the photograph. Keep itinerary rows moving
          beneath that header region without letting their text show through around the card. */}
      <Animated.View
        pointerEvents="none"
        style={[s.headerContentMask, headerContentMask]}
      />

      <StopRail
        stops={railStops}
        index={viewedIdx}
        scrollY={scrollY}
        transitionActive={railTransitionActive}
        onSelect={handleSelectStop}
        onLayoutHeight={onRailLayout}
      />

      {/* The active card and the collapsed header bar are the same object. It takes over
          from the rail's real card the instant the scroll leaves zero. */}
      {railStops[viewedIdx] ? (
        <StopMorph
          name={railStops[viewedIdx].name}
          dates={railStops[viewedIdx].dates}
          kicker={railStops[viewedIdx].kicker}
          status={railStops[viewedIdx].status}
          statusTone={railStops[viewedIdx].statusTone}
          count={railStops[viewedIdx].count}
          photo={railStops[viewedIdx].photo}
          stopCount={stops.length}
          index={viewedIdx}
          insetTop={insets.top}
          scrollY={scrollY}
          railTransitionActive={railTransitionActive}
          onStopPress={handleSelectStop}
          onReturnPress={() => handleSelectStop(viewedIdx)}
        />
      ) : null}

      <DetailSheet ref={detail.sheet} />
      <StopFormSheet ref={stopFormSheetRef} tripId={trip.id} editingStop={editingStop ?? undefined} onSaved={refetch} />
      <BookingFormSheet ref={bookingSheetRef} tripId={trip.id} onSaved={refetch} />
      <CustomItemSheet ref={customItemSheetRef} tripId={trip.id} onSaved={refetch} />
      <MapAppSheet
        ref={mapAppSheetRef}
        uid={user?.uid ?? null}
        preferredApp={profile.preferredMapsApp}
        onPreferenceChanged={profile.refetch}
      />
      <DecisionSheet ref={removeEntrySheetRef} />
      <DecisionSheet ref={moveEntrySheetRef} />
      {undoNotice ? (
        <ItineraryUndoToast
          key={undoNotice.id}
          title={undoNotice.title}
          busy={undoNotice.busy}
          failed={undoNotice.failed}
          bottomInset={insets.bottom}
          onUndo={handleUndoRemoval}
          onDismiss={handleDismissRemoval}
        />
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.surface },
  // Content starts where the rail does; the collapsing spacer covers the rail's own height.
  content: { paddingTop: RAIL_TOP, paddingBottom: 28 },

  dateRailLayer: { position: 'relative', zIndex: 20 },

  headerContentMask: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: t.surface,
  },

  addZone: { paddingHorizontal: Gutter, paddingTop: 22 },
}));
