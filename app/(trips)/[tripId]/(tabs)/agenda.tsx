// Agenda: the whole trip in one list, and the only place a booking that is not on the
// itinerary can be seen. Home is day-by-day and shows one stop; this is everything.
//
// Three lenses over one derived row list — by type (the canvas's default), by day, by stop.
// Regrouping only; `src/domain/agenda.ts` builds the rows once and none of the three
// re-derives anything.
//
// Gaps are derived, never authored: `src/domain/gaps.ts` compares each stop's nights against
// the bookings and plans that cover them. Only stays and transport can be missing. They
// render inline under the group that owns them — under the type they belong to, or under
// their stop — and in the by-day lens they are carried by the coverage grid instead, because
// a gap is a range of nights and not a day.
// Reference: docs/design/Jernie Screen.dc.html (the Agenda tab) + components/travel/GapRow.*
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDotsIcon } from 'phosphor-react-native/src/icons/CalendarDots';
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { SquaresFourIcon } from 'phosphor-react-native/src/icons/SquaresFour';
import { useTripContext } from '@/src/contexts/TripContext';
import {
  buildAgenda, groupByDay, groupByRole, groupByStop, type AgendaEntry,
} from '@/src/domain/agenda';
import { deriveCoverage, gapsForStop, type Gap } from '@/src/domain/gaps';
import type { ItemRole } from '@/src/domain/taxonomy';
import { getActiveStopId } from '@/src/domain/trip';
import { iconFor } from '@/src/design/icons';
import { useSwapTransition } from '@/src/design/motion';
import { Gutter, Spacing, Typography } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { Badge, Button, GapRow, ImagePlaceholder, ItineraryRow, Photo, PromptRow, SegmentedControl } from '@/src/ui';
import { formatDateRange, formatDayLabel } from '@/src/utils/dates';
import { getDevNow } from '@/src/utils/devTime';
import type { Booking, BookingType, ItineraryItem } from '@/src/types';
import { AgendaSection } from '@/src/features/jernie/agenda/AgendaSection';
import { CoverageGrid } from '@/src/features/jernie/agenda/CoverageGrid';
import { agendaSub, GROUP_GLYPH, GROUP_TITLE, groupSub } from '@/src/features/jernie/agenda/copy';
import { BookingFormSheet } from '@/src/features/jernie/sheets/BookingFormSheet';
import type { BookingFormSheetRef } from '@/src/features/jernie/sheets/BookingFormSheet';
import { CustomItemSheet } from '@/src/features/jernie/sheets/CustomItemSheet';
import type { CustomItemSheetRef } from '@/src/features/jernie/sheets/CustomItemSheet';
import { EntityDetailSheet } from '@/src/features/jernie/sheets/EntityDetailSheet';
import type { EntityDetailSheetRef } from '@/src/features/jernie/sheets/EntityDetailSheet';

type Lens = 'type' | 'day' | 'stop';

/** Order matters: it is what tells the swap transition which way the content should travel. */
const LENSES: readonly Lens[] = ['type', 'day', 'stop'];

const LENS_ICON_SIZE = 14;

// What an empty group offers instead of an empty space. Ordered by what generates a gap:
// somewhere to sleep, then how you get around, then preferences — PromptRow's own rule.
const EMPTY_PROMPT: Record<ItemRole, { title: string; sub: string; booking?: BookingType }> = {
  move:  { title: 'Nothing booked to get around', sub: 'A flight, a car, a train',   booking: 'rental' },
  sleep: { title: 'Nowhere to sleep yet',         sub: 'Add where you\'re staying',  booking: 'hotel' },
  eat:   { title: 'No tables booked',             sub: 'Add somewhere to eat',       booking: 'restaurant' },
  do:    { title: 'Nothing planned yet',          sub: 'Add something to do' },
};

type Row =
  | { key: string; kind: 'grid' }
  | { key: string; kind: 'section'; sectionKey: string; Glyph: typeof MapPinIcon; title: string; sub: string; count: number; collapsed: boolean; first: boolean }
  | { key: string; kind: 'entry'; entry: AgendaEntry }
  | { key: string; kind: 'gap'; gap: Gap }
  | { key: string; kind: 'prompt'; role: ItemRole };

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AgendaTab() {
  const { trip, stops, bookings, itinerary, places, enrichment, refetch } = useTripContext();
  const insets = useSafeAreaInsets();
  const [s, t] = useStyles();

  const now = getDevNow();
  const todayIso = isoOf(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const activeStopId = getActiveStopId(stops, now);

  const [lens, setLens] = useState<Lens>('type');
  // The list travels the way the thumb did, on the same spring the segmented pill uses, so
  // the control and the content settle together. See src/design/motion.ts.
  const swap = useSwapTransition(LENSES.indexOf(lens));
  const listRef = useRef<FlashListRef<Row>>(null);
  // A scroll position means nothing across a regrouping — the rows under it are different
  // rows. Not animated: the swap *is* the transition, and two motions would fight.
  useEffect(() => { listRef.current?.scrollToOffset({ offset: 0, animated: false }); }, [lens]);
  // Section keys, not indices — the keys are stable across a lens switch, so collapsing
  // "Where you're eating" and switching to by-day and back leaves it collapsed.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }, []);

  const entitySheetRef = useRef<EntityDetailSheetRef>(null);
  const bookingSheetRef = useRef<BookingFormSheetRef>(null);
  const customItemSheetRef = useRef<CustomItemSheetRef>(null);

  const coverage = useMemo(
    () => deriveCoverage({ stops, bookings, itinerary }),
    [stops, bookings, itinerary],
  );

  const entries = useMemo(
    () => buildAgenda({
      stops, bookings, itinerary, places, enrichment,
      now: { todayIso, minutes: nowMinutes },
    }),
    [stops, bookings, itinerary, places, enrichment, todayIso, nowMinutes],
  );

  // ── Opening a row ─────────────────────────────────────────────────────────
  // Every row opens the same detail sheet Session 6 rebuilds; nothing here is a new surface.

  const openBooking = useCallback((booking: Booking) => {
    const stop = stops.find(st => st.id === booking.stopId);
    const base = {
      stopLabel: stop?.city ?? trip.name,
      stopColor: stop?.color ?? t.action,
      onEdit: () => bookingSheetRef.current?.present({
        type: booking.type, stopId: booking.stopId, editingBooking: booking,
      }),
    };
    switch (booking.type) {
      case 'flight':     entitySheetRef.current?.present({ kind: 'flight',     booking, ...base }); break;
      case 'hotel':      entitySheetRef.current?.present({ kind: 'hotel',      booking, ...base }); break;
      case 'rental':     entitySheetRef.current?.present({ kind: 'rental',     booking, ...base }); break;
      case 'restaurant': entitySheetRef.current?.present({ kind: 'restaurant', booking, ...base }); break;
    }
  }, [stops, trip.name, t.action]);

  const openEntry = useCallback((entry: AgendaEntry) => {
    const stop = stops.find(st => st.id === entry.stopId);
    // Bound to a local so the union narrows inside the `find` callbacks — a narrowing on
    // `entry.source` does not survive the closure.
    const source = entry.source;

    if (source.kind === 'booking') {
      const booking = bookings.find(b => b.id === source.bookingId);
      if (booking) openBooking(booking);
      return;
    }

    if (source.kind === 'place') {
      const place = places.find(p => p.id === source.placeId);
      if (!place) return;
      entitySheetRef.current?.present({
        kind: place.category === 'hike' ? 'hike' : 'place',
        name: place.name,
        stopLabel: stop?.city ?? trip.name,
        stopColor: stop?.color ?? t.action,
        place,
        // Trivially true — a row on the agenda is already in the plan.
        isAdded: true,
      });
      return;
    }

    const { itemId } = source;
    const day = (itinerary[entry.stopId] ?? []).find(d => d.items.some(i => i.id === itemId));
    const editingItem: ItineraryItem | undefined = day?.items.find(i => i.id === itemId);
    if (day && editingItem) {
      customItemSheetRef.current?.present({ stopId: entry.stopId, day, editingItem });
    }
  }, [stops, bookings, places, itinerary, trip.name, t.action, openBooking]);

  const fixGap = useCallback((gap: Gap) => {
    bookingSheetRef.current?.present({
      type: gap.kind === 'stay' ? 'hotel' : 'rental',
      stopId: gap.stopId,
    });
  }, []);

  const addTo = useCallback((role: ItemRole) => {
    const stopId = activeStopId ?? stops[0]?.id;
    if (!stopId) return;
    const booking = EMPTY_PROMPT[role].booking;
    if (booking) bookingSheetRef.current?.present({ type: booking, stopId });
    else customItemSheetRef.current?.present({ stopId });
  }, [activeStopId, stops]);

  // ── The flat list, one shape per lens ─────────────────────────────────────

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    if (coverage.gaps.length > 0) out.push({ key: 'grid', kind: 'grid' });

    const section = (
      sectionKey: string,
      Glyph: typeof MapPinIcon,
      title: string,
      sub: string,
      count: number,
    ) => {
      const first = out.length === 0 || out[out.length - 1].kind === 'grid';
      out.push({ key: `s:${sectionKey}`, kind: 'section', sectionKey, Glyph, title, sub, count, collapsed: collapsed.has(sectionKey), first });
      return !collapsed.has(sectionKey);
    };

    if (lens === 'type') {
      for (const { role, entries: group } of groupByRole(entries)) {
        // Only the two gap-generating roles own any: a stay gap belongs under "Where you're
        // staying", a transport gap under "Getting around". Eating and doing own none.
        const mine = role === 'sleep' ? coverage.gaps.filter(g => g.kind === 'stay')
                   : role === 'move'  ? coverage.gaps.filter(g => g.kind === 'transport')
                   : [];
        if (!section(`type:${role}`, GROUP_GLYPH[role], GROUP_TITLE[role], groupSub(role, group, coverage), group.length)) continue;
        for (const entry of group) out.push({ key: entry.id, kind: 'entry', entry });
        for (const gap of mine) out.push({ key: gap.id, kind: 'gap', gap });
        // A prompt only where the gap rows are not already saying it louder.
        if (group.length === 0 && mine.length === 0) out.push({ key: `p:${role}`, kind: 'prompt', role });
      }
      return out;
    }

    if (lens === 'day') {
      for (const { dateIso, entries: group } of groupByDay(entries)) {
        const label = dateIso === todayIso ? `Today · ${formatDayLabel(dateIso)}` : formatDayLabel(dateIso);
        if (!section(`day:${dateIso}`, CalendarDotsIcon, label, `${group.length} plan${group.length === 1 ? '' : 's'}`, group.length)) continue;
        for (const entry of group) out.push({ key: entry.id, kind: 'entry', entry });
      }
      return out;
    }

    // `groupByStop` returns one group per stop, in the order given, so the two zip by index.
    const byStop = groupByStop(entries, stops);
    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i];
      const group = byStop[i].entries;
      const mine = gapsForStop(coverage, stop.id);
      const range = formatDateRange(stop.dates.start, stop.dates.end);
      const sub = mine.length > 0
        ? `${range} · ${mine.length} gap${mine.length === 1 ? '' : 's'}`
        : `${range} · everything booked`;
      if (!section(`stop:${stop.id}`, MapPinIcon, stop.city, sub, group.length)) continue;
      for (const entry of group) out.push({ key: entry.id, kind: 'entry', entry });
      for (const gap of mine) out.push({ key: gap.id, kind: 'gap', gap });
    }
    return out;
  }, [lens, entries, coverage, collapsed, stops, todayIso]);

  const renderItem = useCallback(({ item }: { item: Row }) => {
    switch (item.kind) {
      case 'grid':
        return <CoverageGrid coverage={coverage} activeStopId={activeStopId} testID="coverage-grid" />;

      case 'section':
        return (
          <AgendaSection
            testID={`section-${item.sectionKey}`}
            Glyph={item.Glyph}
            title={item.title}
            sub={item.sub}
            count={item.count}
            collapsed={item.collapsed}
            first={item.first}
            onToggle={() => toggle(item.sectionKey)}
          />
        );

      case 'entry': {
        const e = item.entry;
        return (
          <View style={s.gutter}>
            <ItineraryRow
              testID={`agenda-${e.id}`}
              time={e.dayLabel}
              duration={e.timeLabel}
              title={e.title}
              sub={e.sub}
              now={e.next}
              photo={e.photo ? <Photo source={e.photo} style={s.fill} /> : undefined}
              icon={e.photo ? undefined : <ImagePlaceholder Glyph={iconFor(e.category, e.subtype)} style={s.fill} glyphSize={19} />}
              badge={e.booked ? <Badge label="Booked" tone="accent" /> : undefined}
              onPress={() => openEntry(e)}
            />
          </View>
        );
      }

      case 'gap':
        return (
          <View style={[s.gutter, s.gapSlot]}>
            <GapRow testID={`gap-${item.gap.id}`} title={item.gap.title} sub={item.gap.sub} onAction={() => fixGap(item.gap)} />
          </View>
        );

      case 'prompt': {
        const p = EMPTY_PROMPT[item.role];
        return (
          <View style={[s.gutter, s.gapSlot]}>
            <PromptRow
              testID={`prompt-${item.role}`}
              title={p.title}
              sub={p.sub}
              action="Add"
              icon={<GroupGlyph role={item.role} color={t.textMuted} />}
              onPress={() => addTo(item.role)}
            />
          </View>
        );
      }
    }
  }, [coverage, activeStopId, toggle, s, t.textMuted, openEntry, fixGap, addTo]);

  const headerSub = agendaSub({
    tripName: trip.name,
    stops,
    todayIso,
    gapCount: coverage.gaps.length,
  });

  return (
    <View style={s.screen}>
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <View style={s.titleRow}>
          <View style={s.titleBlock}>
            <Text style={s.title} numberOfLines={1}>Agenda</Text>
            <Text style={s.sub} numberOfLines={1}>{headerSub}</Text>
          </View>
          {/* The primitive, not the canvas's bare round `+`. `Button` has no icon-only mode,
              and a labelled Add is less ambiguous than a naked glyph anyway. */}
          <Button
            testID="agenda-add"
            label="Add"
            variant="secondary"
            size="sm"
            icon={<PlusIcon size={14} color={t.text} />}
            onPress={() => addTo('do')}
          />
        </View>

        <SegmentedControl
          testID="agenda-lens"
          value={lens}
          onChange={(v) => setLens(v as Lens)}
          options={[
            { value: 'type', label: 'By type', icon: <SquaresFourIcon size={LENS_ICON_SIZE} color={lens === 'type' ? t.text : t.textMuted} weight={lens === 'type' ? 'fill' : 'regular'} /> },
            { value: 'day',  label: 'By day',  icon: <CalendarDotsIcon size={LENS_ICON_SIZE} color={lens === 'day' ? t.text : t.textMuted} weight={lens === 'day' ? 'fill' : 'regular'} /> },
            { value: 'stop', label: 'By stop', icon: <MapPinIcon size={LENS_ICON_SIZE} color={lens === 'stop' ? t.text : t.textMuted} weight={lens === 'stop' ? 'fill' : 'regular'} /> },
          ]}
        />
      </View>

      <Animated.View style={[s.list, swap]}>
        <FlashList
          ref={listRef}
          data={rows}
          renderItem={renderItem}
          keyExtractor={(row) => row.key}
          // Recycling pools are per type, so a section header is never recycled into a row.
          getItemType={(row) => row.kind}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        />
      </Animated.View>

      <EntityDetailSheet ref={entitySheetRef} />
      <BookingFormSheet ref={bookingSheetRef} tripId={trip.id} onSaved={refetch} />
      <CustomItemSheet ref={customItemSheetRef} tripId={trip.id} onSaved={refetch} />
    </View>
  );
}

function GroupGlyph({ role, color }: { role: ItemRole; color: string }) {
  const Glyph = GROUP_GLYPH[role];
  return <Glyph size={17} color={color} weight="regular" />;
}

const useStyles = createThemedStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.surface },

  header: {
    paddingHorizontal: Gutter,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: t.borderSoft,
    backgroundColor: t.surface,
  },
  titleRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.md, marginBottom: Spacing.md },
  titleBlock: { flex: 1, minWidth: 0 },
  title:      { ...Typography.roles.screen, color: t.text },
  sub:        { ...Typography.roles.sub, color: t.textMuted, marginTop: 5 },

  list:    { flex: 1 },
  content: { paddingBottom: 28 },
  gutter:  { paddingHorizontal: Gutter },
  gapSlot: { paddingTop: 9 },
  fill:    { width: '100%', height: '100%' },
}));
