import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Trip, StopWithColor } from '@/src/types';
import { Core, Typography, Radius, Shadow, Spacing } from '@/src/design/tokens';

type SetupKey = keyof Trip['setupIntent'];

const SETUP_ROWS: Array<{ key: SetupKey; emoji: string; label: string; cta: string }> = [
  { key: 'flights',     emoji: '✈️', label: 'Flights',      cta: 'Book →' },
  { key: 'stays',       emoji: '🏨', label: 'Stays',        cta: 'Book →' },
  { key: 'car',         emoji: '🚗', label: 'Rental car',   cta: 'Add →'  },
  { key: 'restaurants', emoji: '🍽️', label: 'Restaurants',  cta: 'Add →'  },
];

interface CTACardZoneProps {
  trip: Trip;
  stops: StopWithColor[];
  onDismiss: () => void;
}

export function CTACardZone({ trip, stops, onDismiss }: CTACardZoneProps) {
  const stopColor = stops[0]?.color ?? '#2C5880';
  const doneCount = SETUP_ROWS.filter(r => trip.setupIntent[r.key]).length;
  const progressPct = Math.round((doneCount / SETUP_ROWS.length) * 100);

  return (
    <View style={[styles.card, Shadow.cardResting]}>
      <View style={styles.headerRow}>
        <Text style={styles.tripName} numberOfLines={1}>{trip.name}</Text>
        <Text style={[styles.progressLabel, { color: stopColor }]}>{progressPct}%</Text>
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.dismiss}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPct}%` as `${number}%`, backgroundColor: stopColor }]} />
      </View>

      {SETUP_ROWS.map(row => {
        const done = trip.setupIntent[row.key];
        return (
          <View key={row.key} style={styles.checkRow}>
            <Text style={styles.checkMark}>{done ? '✓' : '○'}</Text>
            <Text style={styles.checkEmoji}>{row.emoji}</Text>
            <Text style={[styles.checkLabel, done && styles.checkLabelDone]}>{row.label}</Text>
            {!done && <Text style={[styles.ctaText, { color: stopColor }]}>{row.cta}</Text>}
          </View>
        );
      })}

      <View style={styles.emailStrip}>
        <Text style={styles.emailText}>📧 Forward confirmations to add@jernie.app</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    backgroundColor: Core.surface,
    marginHorizontal: Spacing.md,
    marginTop: -4,
    paddingTop: Spacing.base,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    gap: 8,
  },
  tripName:      { ...Typography.roles.h3,        color: Core.text,      flex: 1 },
  progressLabel: { ...Typography.roles.labelCaps },
  dismiss:       { ...Typography.roles.body,       color: Core.textFaint },
  progressTrack: {
    height: 3,
    backgroundColor: Core.surfaceMuted,
    marginHorizontal: Spacing.base,
    borderRadius: Radius.full,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    borderRadius: Radius.full,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: 6,
    gap: 6,
  },
  checkMark:     { ...Typography.roles.label, color: Core.textMuted, width: 16 },
  checkEmoji:    { fontSize: 15 },
  checkLabel:    { ...Typography.roles.body,  color: Core.text,      flex: 1 },
  checkLabelDone:{ color: Core.textMuted },
  ctaText:       { ...Typography.roles.label },
  emailStrip: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Core.border,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  emailText: { ...Typography.roles.meta, color: Core.textFaint },
});
