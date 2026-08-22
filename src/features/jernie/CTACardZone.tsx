import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import type { Trip, StopWithColor, Booking, ItineraryDay, BookingType } from '@/src/types';
import { Core, Radius, Semantic, Shadow, Spacing, Typography } from '@/src/design/tokens';
import { hexWithAlpha } from '@/src/utils/colors';
import type { Icon } from 'phosphor-react-native';
import { ForkKnifeIcon } from 'phosphor-react-native/src/icons/ForkKnife';
import { ListChecksIcon } from 'phosphor-react-native/src/icons/ListChecks';
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { EnvelopeSimpleIcon } from 'phosphor-react-native/src/icons/EnvelopeSimple';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { iconFor, type ItemCategory } from '@/src/design/icons';
import { isTodayBooking, getBookingDisplay } from '@/src/domain/bookings';
import type { DueNudgeLevel } from '@/src/domain/saveNudge';

interface CTACardZoneProps {
  trip: Trip;
  activeStop: StopWithColor;
  bookings: Booking[];      // bookings for the active stop
  days: ItineraryDay[];     // itinerary days for the active stop
  now: Date;
  isDismissed: boolean;
  onDismiss: () => void;
  /** Opens the booking form for a type — from a pre-trip setup row or an in-trip quick action. */
  onAddBooking?: (type: BookingType) => void;
  /** In-trip only: opens the custom itinerary-item flow. */
  onLogActivity?: () => void;
  /** When a nudge is due, outranks the phase router entirely — see CTACardZone below. */
  saveNudge?: {
    level: DueNudgeLevel;
    busy?: boolean;
    error?: string | null;
    onSave: () => void;
    onSnooze: () => void;
  } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type SetupKey = keyof Trip['setupIntent'];

const SETUP_ROWS: Array<{ key: SetupKey; category: ItemCategory; label: string; cta: string }> = [
  { key: 'flights',     category: 'flight', label: 'Flights',     cta: 'Book' },
  { key: 'stays',       category: 'stay',   label: 'Stays',       cta: 'Book' },
  { key: 'car',         category: 'car',    label: 'Rental car',  cta: 'Add'  },
  { key: 'restaurants', category: 'food',   label: 'Restaurants', cta: 'Add'  },
];

// SETUP_ROWS' keys come from Trip['setupIntent'] and are NOT the BookingType strings —
// map by key, never by array position.
const SETUP_ROW_BOOKING_TYPE: Record<SetupKey, BookingType> = {
  flights: 'flight',
  stays: 'hotel',
  car: 'rental',
  restaurants: 'restaurant',
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function parseDateLabel(isoDate: string): string {
  const [, m, d] = isoDate.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

function computeDayNumber(startIso: string, todayIso: string): number {
  const [sy, sm, sd] = startIso.split('-').map(Number);
  const [ty, tm, td] = todayIso.split('-').map(Number);
  return Math.floor((Date.UTC(ty, tm - 1, td) - Date.UTC(sy, sm - 1, sd)) / 86400000) + 1;
}

// ─── Pre-trip card — setup checklist ────────────────────────────────────────

function PreTripCard({
  trip,
  onDismiss,
  onAddBooking,
}: { trip: Trip; onDismiss: () => void; onAddBooking?: (type: BookingType) => void }) {
  return (
    <View style={[styles.card, Shadow.row]}>
      <View style={styles.headerRow}>
        <Text style={styles.tripName} numberOfLines={1}>{trip.name}</Text>
        <TouchableOpacity testID="cta-dismiss" onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <XIcon size={13} color={Core.textFaint} />
        </TouchableOpacity>
      </View>

      <View style={styles.checkList}>
        {SETUP_ROWS.map(row => {
          const done = trip.setupIntent[row.key];
          return (
            <TouchableOpacity
              key={row.key}
              testID={`setup-row-${row.key}`}
              style={styles.checkRow}
              activeOpacity={0.7}
              onPress={() => onAddBooking?.(SETUP_ROW_BOOKING_TYPE[row.key])}
            >
              <View style={[styles.checkIcon, done ? styles.checkIconDone : styles.checkIconTodo]}>
                {(() => { const Glyph = iconFor(row.category); return <Glyph size={16} color={done ? Core.action : Core.textMuted} weight={done ? 'fill' : 'regular'} />; })()}
              </View>
              <View style={styles.checkTextBlock}>
                <Text style={[styles.checkLabel, done && styles.checkLabelDone]}>{row.label}</Text>
                {done && <Text style={styles.checkSubDone}>Added</Text>}
                {!done && <Text style={styles.checkSubTodo}>{row.cta}</Text>}
              </View>
              <Text style={[styles.checkBadge, done ? styles.checkBadgeDone : styles.checkBadgeTodo]}>
                {done ? '' : '·'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.emailStrip}>
        <EnvelopeSimpleIcon size={13} color={Core.textFaint} />
        <Text style={styles.emailText}>Forward confirmations to add@jernie.app</Text>
      </View>
    </View>
  );
}

// ─── In-trip card — today's agenda ──────────────────────────────────────────

function InTripCard({
  activeStop,
  bookings,
  days,
  todayIso,
  onAddBooking,
  onLogActivity,
}: {
  activeStop: StopWithColor;
  bookings: Booking[];
  days: ItineraryDay[];
  todayIso: string;
  onAddBooking?: (type: BookingType) => void;
  onLogActivity?: () => void;
}) {
  const dayNum = computeDayNumber(activeStop.dates.start, todayIso);
  const dateStr = parseDateLabel(todayIso);
  const todayBookings = bookings.filter(b => isTodayBooking(b, todayIso));
  const todayDay = days.find(d => d.dateIso === todayIso);
  const itemCount = todayDay?.items.length ?? 0;

  return (
    <View style={[styles.card, Shadow.row]}>
      {/* Header: day badge + city + date */}
      <View style={styles.inTripHeaderRow}>
        <View style={[styles.dayBadge, { backgroundColor: hexWithAlpha(activeStop.color, 0.12) }]}>
          <Text style={[styles.dayBadgeText, { color: activeStop.color }]}>Day {dayNum}</Text>
        </View>
        <View style={styles.inTripCityRow}>
          <MapPinIcon size={13} color={Core.textMuted} weight="fill" />
          <Text style={styles.inTripCity} numberOfLines={1}>{activeStop.city}</Text>
        </View>
        <Text style={styles.inTripDate}>{dateStr}</Text>
      </View>

      {/* Today's booking reminders */}
      {todayBookings.length > 0 && (
        <View style={styles.sectionBlock}>
          {todayBookings.map(b => {
            const info = getBookingDisplay(b, todayIso);
            const Glyph = iconFor(info.category);
            return (
              <View key={b.id} style={styles.bookingRow}>
                <Glyph size={16} color={Core.textMuted} weight="fill" style={styles.bookingIcon} />
                <View style={styles.bookingText}>
                  <Text style={styles.bookingLabel} numberOfLines={1}>{info.label}</Text>
                  <Text style={styles.bookingMeta}>{info.meta}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Agenda item count */}
      {itemCount > 0 && (
        <View style={[styles.sectionBlock, styles.agendaRow]}>
          <ListChecksIcon size={14} color={Core.textMuted} />
          <Text style={styles.agendaText}>
            {itemCount} item{itemCount !== 1 ? 's' : ''} on today's agenda
          </Text>
        </View>
      )}

      {/* Quick-add actions */}
      <View style={styles.quickActionsRow}>
        <QuickActionButton
          testID="quick-action-restaurant"
          Glyph={ForkKnifeIcon}
          label="Add restaurant"
          color={activeStop.color}
          onPress={() => onAddBooking?.('restaurant')}
        />
        <QuickActionButton
          testID="quick-action-log-activity"
          Glyph={PlusIcon}
          label="Log activity"
          color={activeStop.color}
          onPress={onLogActivity}
        />
      </View>
    </View>
  );
}

function QuickActionButton({ testID, Glyph, label, color, onPress }: {
  testID: string; Glyph: Icon; label: string; color: string; onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      style={[styles.quickBtn, { borderColor: hexWithAlpha(color, 0.3) }]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <Glyph size={15} color={color} />
      <Text style={[styles.quickBtnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Save nudge card — an unsaved trip needs saving in every phase ──────────

function SaveTripCard({
  level, busy, error, onSave, onSnooze,
}: { level: DueNudgeLevel; busy?: boolean; error?: string | null; onSave: () => void; onSnooze: () => void }) {
  const firm = level === 'firm';
  return (
    <View testID="save-nudge-card" style={[styles.card, Shadow.row]}>
      <Text style={styles.cardTitle}>
        {firm ? 'This trip only exists on this phone' : 'Save your trip'}
      </Text>
      <Text style={styles.cardSub}>
        {firm
          ? "If you lose this phone, this trip goes with it. There's no way to recover it."
          : 'Sign in and your trip follows you to any phone.'}
      </Text>
      {error && <Text testID="save-nudge-error" style={styles.nudgeErrorText}>{error}</Text>}
      <TouchableOpacity
        testID="save-nudge-save"
        style={[styles.primaryButton, busy && styles.primaryButtonDisabled]}
        onPress={onSave}
        disabled={busy}
      >
        {busy
          ? <ActivityIndicator color={Core.textInverse} />
          : <Text style={styles.primaryButtonText}>Sign in with Apple</Text>}
      </TouchableOpacity>
      <TouchableOpacity testID="save-nudge-dismiss" onPress={onSnooze} disabled={busy}>
        <Text style={styles.dismissText}>Not now</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main export — phase router ──────────────────────────────────────────────

// Which card variant a given set of inputs renders, without any of the presentation. The
// caller needs this to detect a swap between differently-sized cards (e.g. the save nudge
// disappearing back to the pre-trip checklist) so it can re-measure the height it froze on
// first layout — see the `cardKind` usage in jernie.tsx (I5). Kept in lockstep with the
// render logic below by construction: both switch on the same `phase`.
export type CtaCardKind = 'nudge' | 'pre' | 'in' | null;

export function getCtaCardKind({
  activeStop,
  now,
  isDismissed,
  saveNudge,
}: Pick<CTACardZoneProps, 'activeStop' | 'now' | 'isDismissed' | 'saveNudge'>): CtaCardKind {
  if (saveNudge) return 'nudge';
  const todayIso = now.toISOString().split('T')[0];
  const phase: 'pre' | 'in' | 'post' =
    todayIso < activeStop.dates.start ? 'pre' :
    todayIso <= activeStop.dates.end  ? 'in'  : 'post';
  if (phase === 'post') return null;
  if (phase === 'pre' && isDismissed) return null;
  return phase;
}

export function CTACardZone({
  trip,
  activeStop,
  bookings,
  days,
  now,
  isDismissed,
  onDismiss,
  onAddBooking,
  onLogActivity,
  saveNudge,
}: CTACardZoneProps) {
  const kind = getCtaCardKind({ activeStop, now, isDismissed, saveNudge });

  // Outranks the phase router deliberately: an unsaved trip needs nudging in every phase,
  // and the router below returns null for 'post' and for a dismissed 'pre'.
  if (kind === 'nudge' && saveNudge) {
    return (
      <SaveTripCard
        level={saveNudge.level}
        busy={saveNudge.busy}
        error={saveNudge.error}
        onSave={saveNudge.onSave}
        onSnooze={saveNudge.onSnooze}
      />
    );
  }

  if (kind === null) return null;

  if (kind === 'pre') {
    return <PreTripCard trip={trip} onDismiss={onDismiss} onAddBooking={onAddBooking} />;
  }
  const todayIso = now.toISOString().split('T')[0];
  return (
    <InTripCard
      activeStop={activeStop}
      bookings={bookings}
      days={days}
      todayIso={todayIso}
      onAddBooking={onAddBooking}
      onLogActivity={onLogActivity}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    backgroundColor: Core.surface,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    overflow: 'hidden',
  },

  // Pre-trip
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.sm,
    gap: 8,
  },
  tripName: { ...Typography.roles.section, color: Core.text, flex: 1 },
  dismiss:  { ...Typography.roles.body, color: Core.textFaint },
  checkList: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Core.surface,
    borderWidth: 1,
    borderColor: Core.border,
    borderRadius: 14,
    padding: 10,
    ...Shadow.row,
  },
  checkIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkIconDone: { backgroundColor: Core.actionSoft },
  checkIconTodo: {
    backgroundColor: Core.surfaceMuted,
    borderWidth: 1.5,
    borderStyle: 'dashed' as const,
    borderColor: Core.border,
  },
  checkTextBlock: { flex: 1 },
  checkLabel:     { ...Typography.roles.chip, color: Core.text, fontWeight: '600' as const },
  checkLabelDone: { color: Core.textMuted },
  checkSubDone:   { ...Typography.roles.sub, color: Core.textFaint, marginTop: 1 },
  checkSubTodo:   { ...Typography.roles.sub, color: Core.textFaint, marginTop: 1 },
  checkBadge:     { fontSize: 13, fontFamily: 'DMSans', fontWeight: '700' as const },
  checkBadgeDone: { color: Core.action },
  checkBadgeTodo: { color: Core.textFaint },
  emailStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Core.border,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  emailText: { ...Typography.roles.sub, color: Core.textFaint },

  // In-trip
  inTripHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.sm,
    gap: 8,
  },
  dayBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dayBadgeText:  { ...Typography.roles.caps },
  inTripCityRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  inTripCity:    { ...Typography.roles.section,   color: Core.text,     flex: 1 },
  inTripDate:    { ...Typography.roles.sub,  color: Core.textMuted },
  sectionBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Core.border,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  bookingRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 10 },
  bookingIcon:   { width: 22 },
  bookingText:   { flex: 1 },
  bookingLabel:  { ...Typography.roles.chip, color: Core.text },
  bookingMeta:   { ...Typography.roles.sub,  color: Core.textMuted, marginTop: 1 },
  agendaRow:     { flexDirection: 'row', alignItems: 'center', gap: 7 },
  agendaText:    { ...Typography.roles.body,  color: Core.textMuted },
  quickActionsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Core.border,
    gap: 8,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickBtnText: { ...Typography.roles.chip },

  // Save nudge
  cardTitle: { ...Typography.roles.section, color: Core.text, paddingHorizontal: Spacing.base, paddingTop: Spacing.base },
  cardSub: {
    ...Typography.roles.body,
    color: Core.textMuted,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  primaryButton: {
    backgroundColor: Core.text,
    borderRadius: Radius.full,
    marginHorizontal: Spacing.base,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { ...Typography.roles.button, color: Core.textInverse },
  nudgeErrorText: {
    ...Typography.roles.sub,
    color: Semantic.error,
    textAlign: 'center',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xs,
  },
  dismissText: {
    ...Typography.roles.chip,
    color: Core.textFaint,
    textAlign: 'center',
    paddingVertical: Spacing.base,
  },
});
