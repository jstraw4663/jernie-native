import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Trip, StopWithColor, Booking, ItineraryDay } from '@/src/types';
import { Core, Semantic, Typography, Radius, Shadow, Spacing } from '@/src/design/tokens';
import { hexWithAlpha } from '@/src/utils/colors';
import { isTodayBooking, getBookingDisplay } from '@/src/domain/bookings';

interface CTACardZoneProps {
  trip: Trip;
  activeStop: StopWithColor;
  bookings: Booking[];      // bookings for the active stop
  days: ItineraryDay[];     // itinerary days for the active stop
  now: Date;
  isDismissed: boolean;
  onDismiss: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type SetupKey = keyof Trip['setupIntent'];

const SETUP_ROWS: Array<{ key: SetupKey; emoji: string; label: string; cta: string }> = [
  { key: 'flights',     emoji: '✈️', label: 'Flights',     cta: 'Book →' },
  { key: 'stays',       emoji: '🏨', label: 'Stays',       cta: 'Book →' },
  { key: 'car',         emoji: '🚗', label: 'Rental car',  cta: 'Add →'  },
  { key: 'restaurants', emoji: '🍽️', label: 'Restaurants', cta: 'Add →'  },
];

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
}: { trip: Trip; onDismiss: () => void }) {
  return (
    <View style={[styles.card, Shadow.cardResting]}>
      <View style={styles.headerRow}>
        <Text style={styles.tripName} numberOfLines={1}>{trip.name}</Text>
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.dismiss}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.checkList}>
        {SETUP_ROWS.map(row => {
          const done = trip.setupIntent[row.key];
          return (
            <View key={row.key} style={styles.checkRow}>
              <View style={[styles.checkIcon, done ? styles.checkIconDone : styles.checkIconTodo]}>
                <Text style={styles.checkEmoji}>{row.emoji}</Text>
              </View>
              <View style={styles.checkTextBlock}>
                <Text style={[styles.checkLabel, done && styles.checkLabelDone]}>{row.label}</Text>
                {done && <Text style={styles.checkSubDone}>Added</Text>}
                {!done && <Text style={styles.checkSubTodo}>{row.cta}</Text>}
              </View>
              <Text style={[styles.checkBadge, done ? styles.checkBadgeDone : styles.checkBadgeTodo]}>
                {done ? '✓' : '·'}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.emailStrip}>
        <Text style={styles.emailText}>📧  Forward confirmations to add@jernie.app</Text>
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
}: { activeStop: StopWithColor; bookings: Booking[]; days: ItineraryDay[]; todayIso: string }) {
  const dayNum = computeDayNumber(activeStop.dates.start, todayIso);
  const dateStr = parseDateLabel(todayIso);
  const todayBookings = bookings.filter(b => isTodayBooking(b, todayIso));
  const todayDay = days.find(d => d.dateIso === todayIso);
  const itemCount = todayDay?.items.length ?? 0;

  return (
    <View style={[styles.card, Shadow.cardResting]}>
      {/* Header: day badge + city + date */}
      <View style={styles.inTripHeaderRow}>
        <View style={[styles.dayBadge, { backgroundColor: hexWithAlpha(activeStop.color, 0.12) }]}>
          <Text style={[styles.dayBadgeText, { color: activeStop.color }]}>Day {dayNum}</Text>
        </View>
        <Text style={styles.inTripCity} numberOfLines={1}>
          {activeStop.emoji}{'  '}{activeStop.city}
        </Text>
        <Text style={styles.inTripDate}>{dateStr}</Text>
      </View>

      {/* Today's booking reminders */}
      {todayBookings.length > 0 && (
        <View style={styles.sectionBlock}>
          {todayBookings.map(b => {
            const info = getBookingDisplay(b, todayIso);
            return (
              <View key={b.id} style={styles.bookingRow}>
                <Text style={styles.bookingEmoji}>{info.emoji}</Text>
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
          <Text style={styles.agendaText}>
            📋{'  '}{itemCount} item{itemCount !== 1 ? 's' : ''} on today's agenda
          </Text>
        </View>
      )}

      {/* Quick-add actions */}
      <View style={styles.quickActionsRow}>
        <QuickActionButton emoji="🍽️" label="Add restaurant" color={activeStop.color} />
        <QuickActionButton emoji="✚" label="Log activity" color={activeStop.color} />
      </View>
    </View>
  );
}

function QuickActionButton({ emoji, label, color }: { emoji: string; label: string; color: string }) {
  return (
    <TouchableOpacity
      style={[styles.quickBtn, { borderColor: hexWithAlpha(color, 0.3) }]}
      activeOpacity={0.7}
    >
      <Text style={[styles.quickBtnText, { color }]}>{emoji}{'  '}{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Main export — phase router ──────────────────────────────────────────────

export function CTACardZone({
  trip,
  activeStop,
  bookings,
  days,
  now,
  isDismissed,
  onDismiss,
}: CTACardZoneProps) {
  const todayIso = now.toISOString().split('T')[0];
  const phase: 'pre' | 'in' | 'post' =
    todayIso < activeStop.dates.start ? 'pre' :
    todayIso <= activeStop.dates.end  ? 'in'  : 'post';

  if (phase === 'post') return null;
  if (phase === 'pre' && isDismissed) return null;

  if (phase === 'pre') {
    return <PreTripCard trip={trip} onDismiss={onDismiss} />;
  }
  return <InTripCard activeStop={activeStop} bookings={bookings} days={days} todayIso={todayIso} />;
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
  tripName: { ...Typography.roles.h3, color: Core.text, flex: 1 },
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
    ...Shadow.cardResting,
  },
  checkIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkIconDone: { backgroundColor: Semantic.successTint },
  checkIconTodo: {
    backgroundColor: Core.surfaceMuted,
    borderWidth: 1.5,
    borderStyle: 'dashed' as const,
    borderColor: Core.border,
  },
  checkEmoji:     { fontSize: 14 },
  checkTextBlock: { flex: 1 },
  checkLabel:     { ...Typography.roles.label, color: Core.text, fontWeight: '600' as const },
  checkLabelDone: { color: Core.textMuted },
  checkSubDone:   { ...Typography.roles.meta, color: Core.textFaint, marginTop: 1 },
  checkSubTodo:   { ...Typography.roles.meta, color: Core.textFaint, marginTop: 1 },
  checkBadge:     { fontSize: 13, fontFamily: 'DMSans', fontWeight: '700' as const },
  checkBadgeDone: { color: Semantic.success },
  checkBadgeTodo: { color: Core.textFaint },
  emailStrip: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Core.border,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  emailText: { ...Typography.roles.meta, color: Core.textFaint },

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
  dayBadgeText:  { ...Typography.roles.labelCaps },
  inTripCity:    { ...Typography.roles.h3,   color: Core.text,     flex: 1 },
  inTripDate:    { ...Typography.roles.meta,  color: Core.textMuted },
  sectionBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Core.border,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  bookingRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 10 },
  bookingEmoji:  { fontSize: 16, width: 22, textAlign: 'center' },
  bookingText:   { flex: 1 },
  bookingLabel:  { ...Typography.roles.label, color: Core.text },
  bookingMeta:   { ...Typography.roles.meta,  color: Core.textMuted, marginTop: 1 },
  agendaRow:     { flexDirection: 'row', alignItems: 'center' },
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
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingVertical: 8,
    alignItems: 'center',
  },
  quickBtnText: { ...Typography.roles.label },
});
