import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Trip, Stop } from '@/src/types';
import { Typography, Radius, Spacing, Semantic } from '@/src/design/tokens';

interface HeroLayerProps {
  trip: Trip;
  activeStop: Stop;
}

function formatDateRange(start: string, end: string): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  return `${months[s.getMonth()]} ${s.getDate()}–${e.getDate()}`;
}

export function HeroLayer({ trip, activeStop }: HeroLayerProps) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={trip.colorPack.heroGradient}
      style={[styles.hero, { paddingTop: insets.top + Spacing.base }]}
    >
      <View style={styles.pillRow}>
        <View style={styles.tripPill}>
          <Text style={styles.tripPillText}>{trip.name}</Text>
        </View>
        <View style={styles.phasePill}>
          <Text style={styles.phaseText}>Pre-trip</Text>
        </View>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.city}>{activeStop.city}</Text>
        <Text style={styles.subtitle}>
          {formatDateRange(activeStop.dates.start, activeStop.dates.end)} · {activeStop.city}, {activeStop.region}
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: 280,
    borderBottomLeftRadius: Radius.hero,
    borderBottomRightRadius: Radius.hero,
    marginBottom: -4,
    paddingHorizontal: Spacing.base,
    justifyContent: 'space-between',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tripPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tripPillText: {
    ...Typography.roles.label,
    color: 'rgba(255,255,255,0.9)',
  },
  phasePill: {
    backgroundColor: Semantic.warningTint,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  phaseText: {
    ...Typography.roles.label,
    color: Semantic.warning,
  },
  bottom: {
    paddingBottom: Spacing.xl,
  },
  city: {
    ...Typography.roles.display,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    ...Typography.roles.meta,
    color: 'rgba(255,255,255,0.7)',
  },
});
