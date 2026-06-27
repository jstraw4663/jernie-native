import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Core, Brand, Typography, Radius, Shadow, Spacing, Semantic } from '@/src/design/tokens';
import { hexWithAlpha } from '@/src/utils/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;

const GREEN = '#3E7B52';
const RUST  = '#B44F1E';

// ─── Shared primitives ────────────────────────────────────────────────────────

function CardShell({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[styles.shell, Shadow.cardResting, style]}>
      {children}
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function ActionRow({ color, left, right }: { color: string; left: string; right: string }) {
  return (
    <View style={styles.actionRow}>
      <TouchableOpacity
        style={[styles.actionBtn, { borderColor: hexWithAlpha(color, 0.3) }]}
        activeOpacity={0.7}
      >
        <Text style={[styles.actionBtnText, { color }]}>{left}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.actionBtn, { borderColor: hexWithAlpha(color, 0.3) }]}
        activeOpacity={0.7}
      >
        <Text style={[styles.actionBtnText, { color }]}>{right}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Card 1: Trip Setup ───────────────────────────────────────────────────────

function TripSetupCard() {
  const items = [
    { done: true,  emoji: '✈️', label: 'Flights booked'  },
    { done: true,  emoji: '🏨', label: 'Stays booked'    },
    { done: false, emoji: '🚗', label: 'Rental car',   cta: 'Add →' },
    { done: false, emoji: '🍽️', label: 'Restaurants',  cta: 'Add →' },
  ];

  return (
    <CardShell>
      <View style={styles.setupHeader}>
        <Text style={styles.setupTitle} numberOfLines={1}>New England Road Trip</Text>
        <Text style={[styles.setupPct, { color: GREEN }]}>50%</Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: '50%', backgroundColor: GREEN }]} />
      </View>

      {items.map((row, i) => (
        <View key={i} style={styles.checkRow}>
          <Text style={styles.checkMark}>{row.done ? '✓' : '○'}</Text>
          <Text style={styles.checkEmoji}>{row.emoji}</Text>
          <Text style={[styles.checkLabel, row.done && styles.checkLabelDone]}>{row.label}</Text>
          {row.cta && <Text style={[styles.setupCta, { color: GREEN }]}>{row.cta}</Text>}
        </View>
      ))}
    </CardShell>
  );
}

// ─── Card 2: Flight Departure ────────────────────────────────────────────────

function FlightDepartureCard() {
  return (
    <LinearGradient
      colors={[Brand.navy, '#1E4566']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.shell, styles.flightShell, Shadow.cardResting]}
    >
      <View style={styles.flightTopRow}>
        <Text style={styles.flightAirline}>UNITED · UA 123</Text>
        <View style={styles.onTimePill}>
          <Text style={styles.onTimeText}>✓ On Time</Text>
        </View>
      </View>

      <View style={styles.flightRouteRow}>
        <View style={styles.airportBlock}>
          <Text style={styles.airportCode}>PDX</Text>
          <Text style={styles.flightTime}>2:45 PM</Text>
          <Text style={styles.airportCity}>Portland</Text>
        </View>
        <Text style={styles.flightArrow}>→</Text>
        <View style={[styles.airportBlock, { alignItems: 'flex-end' }]}>
          <Text style={styles.airportCode}>BOS</Text>
          <Text style={styles.flightTime}>5:22 PM</Text>
          <Text style={styles.airportCity}>Boston</Text>
        </View>
      </View>

      <Divider />
      <Text style={styles.flightMeta}>Gate B12  ·  Terminal B  ·  Conf: UA892XC</Text>
    </LinearGradient>
  );
}

// ─── Card 3: Hotel Check-in ───────────────────────────────────────────────────

function HotelCheckinCard() {
  return (
    <CardShell style={{ borderWidth: 1, borderColor: hexWithAlpha(GREEN, 0.2) }}>
      <View style={styles.iconRow}>
        <View style={[styles.iconSquare, { backgroundColor: hexWithAlpha(GREEN, 0.12) }]}>
          <Text style={styles.iconEmoji}>🏨</Text>
        </View>
        <View style={styles.iconRowText}>
          <Text style={styles.cardTitle}>Marriott Waterfront</Text>
          <Text style={styles.cardMeta}>King Room, City View</Text>
        </View>
        <View style={[styles.todayBadge, { backgroundColor: hexWithAlpha(GREEN, 0.12) }]}>
          <Text style={[styles.todayBadgeText, { color: GREEN }]}>Today</Text>
        </View>
      </View>

      <Divider />

      <View style={styles.metaGrid}>
        <Text style={styles.metaItem}>🕒{'  '}Check-in from 3:00 PM</Text>
        <Text style={styles.metaItem}>📋{'  '}Confirmation: MR7234</Text>
        <Text style={styles.metaItem}>🛏{'  '}3 nights · Checkout Jun 6</Text>
      </View>

      <ActionRow color={GREEN} left="📍  Directions" right="📞  Call Hotel" />
    </CardShell>
  );
}

// ─── Card 4: Today's Plan ────────────────────────────────────────────────────

function TodayPlanCard() {
  const items = [
    { time: '10:00 AM', emoji: '🌊', label: 'Portland Head Light' },
    { time: '1:00 PM',  emoji: '🍺', label: 'Allagash Brewing Tour' },
    { time: '7:30 PM',  emoji: '🍽️', label: 'Eventide Oyster Co.' },
  ];

  return (
    <CardShell>
      <View style={styles.agendaHeaderRow}>
        <View style={[styles.dayBadge, { backgroundColor: hexWithAlpha(GREEN, 0.12) }]}>
          <Text style={[styles.dayBadgeText, { color: GREEN }]}>DAY 3</Text>
        </View>
        <Text style={styles.agendaCity}>🌲{'  '}Portland</Text>
        <Text style={styles.agendaDate}>Jun 3</Text>
      </View>

      <Divider />

      <View style={styles.agendaList}>
        {items.map((item, i) => (
          <View key={i} style={styles.agendaItem}>
            <Text style={styles.agendaTime}>{item.time}</Text>
            <Text style={styles.agendaEmoji}>{item.emoji}</Text>
            <Text style={styles.agendaLabel} numberOfLines={1}>{item.label}</Text>
          </View>
        ))}
      </View>

      <Divider />
      <ActionRow color={GREEN} left="🍽️  Add restaurant" right="✚  Log activity" />
    </CardShell>
  );
}

// ─── Card 5: Dinner Reservation ───────────────────────────────────────────────

function DinnerReservationCard() {
  return (
    <CardShell style={{ borderWidth: 1, borderColor: hexWithAlpha(RUST, 0.18) }}>
      <View style={styles.iconRow}>
        <View style={[styles.iconSquare, { backgroundColor: hexWithAlpha(RUST, 0.10) }]}>
          <Text style={styles.iconEmoji}>🍽️</Text>
        </View>
        <View style={styles.iconRowText}>
          <Text style={styles.cardTitle}>Eventide Oyster Co.</Text>
          <Text style={styles.cardMeta}>Tonight at 7:30 PM  ·  Party of 2</Text>
        </View>
        <View style={[styles.todayBadge, { backgroundColor: hexWithAlpha(RUST, 0.10) }]}>
          <Text style={[styles.todayBadgeText, { color: RUST }]}>Tonight</Text>
        </View>
      </View>

      <Divider />

      <View style={styles.metaGrid}>
        <Text style={styles.metaItem}>📍{'  '}37 Middle St, Portland ME</Text>
        <Text style={styles.metaItem}>📋{'  '}Confirmation: EV892</Text>
        <Text style={styles.metaItem}>⏱{'  '}Reservation in 4 hours</Text>
      </View>

      <ActionRow color={RUST} left="📍  Directions" right="📱  View Booking" />
    </CardShell>
  );
}

// ─── Dot indicator ────────────────────────────────────────────────────────────

function Dots({ count, active }: { count: number; active: number }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.dot, i === active ? styles.dotActive : styles.dotInactive]} />
      ))}
    </View>
  );
}

// ─── Card registry ────────────────────────────────────────────────────────────

const CARDS = [
  { key: 'setup',   component: <TripSetupCard /> },
  { key: 'flight',  component: <FlightDepartureCard /> },
  { key: 'hotel',   component: <HotelCheckinCard /> },
  { key: 'agenda',  component: <TodayPlanCard /> },
  { key: 'dinner',  component: <DinnerReservationCard /> },
];

// ─── Main carousel ────────────────────────────────────────────────────────────

export function SampleCTACarousel() {
  const [active, setActive] = useState(0);

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        contentContainerStyle={styles.carouselContent}
        onMomentumScrollEnd={e =>
          setActive(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))
        }
      >
        {CARDS.map(({ key, component }) => (
          <View key={key} style={styles.page}>
            {component}
          </View>
        ))}
      </ScrollView>
      <Dots count={CARDS.length} active={active} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  carouselContent: {
    alignItems: 'stretch', // each page fills the ScrollView height (set by tallest card)
  },

  page: {
    width: SCREEN_WIDTH,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flex: 1,
    justifyContent: 'center', // vertically center the card within the page height
  },

  shell: {
    backgroundColor: Core.surface,
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.sm,
    overflow: 'hidden',
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Core.border,
    marginVertical: Spacing.sm,
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: Spacing.xs,
  },
  actionBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingVertical: 7,
    alignItems: 'center',
  },
  actionBtnText: { ...Typography.roles.label },

  // Card 1 — Setup
  setupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  setupTitle:    { ...Typography.roles.h3,        color: Core.text, flex: 1 },
  setupPct:      { ...Typography.roles.labelCaps },
  progressTrack: {
    height: 3,
    backgroundColor: Core.surfaceMuted,
    borderRadius: Radius.full,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  progressFill:  { height: 3, borderRadius: Radius.full },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    gap: 6,
  },
  checkMark:      { ...Typography.roles.label, color: Core.textMuted, width: 14 },
  checkEmoji:     { fontSize: 14 },
  checkLabel:     { ...Typography.roles.body,  color: Core.text,      flex: 1 },
  checkLabelDone: { color: Core.textMuted },
  setupCta:       { ...Typography.roles.label },

  // Card 2 — Flight
  flightShell: { backgroundColor: 'transparent' },
  flightTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.base,
  },
  flightAirline: {
    fontSize: 11,
    fontFamily: 'DMSans',
    fontWeight: '700',
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
  },
  onTimePill: {
    backgroundColor: Semantic.successTint,
    borderRadius: Radius.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  onTimeText: { ...Typography.roles.label, color: Semantic.success },
  flightRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  airportBlock:  { alignItems: 'flex-start' },
  airportCode: {
    fontSize: 28,
    fontFamily: 'Fraunces',
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 32,
  },
  flightTime:   { ...Typography.roles.label, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  airportCity:  { ...Typography.roles.meta,  color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  flightArrow:  { fontSize: 22, color: 'rgba(255,255,255,0.4)' },
  flightMeta:   { ...Typography.roles.meta, color: 'rgba(255,255,255,0.55)' },

  // Cards 3 & 5 — Icon-row cards
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  iconSquare: {
    width: 40,
    height: 40,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji:   { fontSize: 20 },
  iconRowText: { flex: 1 },
  cardTitle:   { ...Typography.roles.label, color: Core.text, fontWeight: '700' },
  cardMeta:    { ...Typography.roles.meta,  color: Core.textMuted, marginTop: 2 },
  todayBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  todayBadgeText: { ...Typography.roles.labelCaps },
  metaGrid:    { gap: 4, marginVertical: Spacing.xs },
  metaItem:    { ...Typography.roles.meta, color: Core.textMuted },

  // Card 4 — Agenda
  agendaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.xs,
  },
  dayBadge:     { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  dayBadgeText: { ...Typography.roles.labelCaps },
  agendaCity:   { ...Typography.roles.h3,   color: Core.text,     flex: 1 },
  agendaDate:   { ...Typography.roles.meta,  color: Core.textMuted },
  agendaList:   { gap: 6 },
  agendaItem:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  agendaTime:   { ...Typography.roles.mono,  color: Core.textMuted, width: 68 },
  agendaEmoji:  { fontSize: 14 },
  agendaLabel:  { ...Typography.roles.label, color: Core.text, flex: 1 },

  // Dots
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
  },
  dot:         { height: 5, borderRadius: 3 },
  dotActive:   { width: 16, backgroundColor: Core.textMuted },
  dotInactive: { width: 5,  backgroundColor: Core.border },
});
