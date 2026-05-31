import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Trip, Stop } from '@/src/types';
import { Typography, Radius, Spacing, Semantic } from '@/src/design/tokens';
import { formatDateRange } from '@/src/utils/dates';
import { getDevNow } from '@/src/utils/devTime';

interface HeroLayerProps {
  trip: Trip;
  activeStop: Stop;   // date-based — drives phase pill label
  visibleStop: Stop;  // scroll-position — drives compact strip city/emoji
  scrollY: SharedValue<number>;
}

export function HeroLayer({ trip, activeStop, visibleStop, scrollY }: HeroLayerProps) {
  const insets = useSafeAreaInsets();

  const todayIso = getDevNow().toISOString().split('T')[0];
  const phaseLabel =
    todayIso < activeStop.dates.start ? 'Pre-trip' :
    todayIso < activeStop.dates.end   ? 'In trip'  :
                                         'Post-trip';

  // Animated container height: 280px → 120px
  const heroStyle = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [0, 120], [280, 120], Extrapolation.CLAMP),
  }));

  // Expanded content (pills + large city + subtitle): fades out 0→80
  const expandedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [1, 0], Extrapolation.CLAMP),
  }));

  // Compact strip (emoji + city + phase pill): fades in 80→120
  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [80, 120], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View style={[styles.container, heroStyle]}>
      {/* LinearGradient fills the animated container */}
      <LinearGradient
        colors={trip.colorPack.heroGradient}
        style={StyleSheet.absoluteFill}
      />

      {/* Expanded layout — fades out as hero shrinks */}
      <Animated.View
        style={[
          styles.expandedContent,
          { paddingTop: insets.top + Spacing.base },
          expandedStyle,
        ]}
      >
        <View style={styles.pillRow}>
          <View style={styles.tripPill}>
            <Text style={styles.tripPillText}>{trip.name}</Text>
          </View>
          <View style={styles.phasePill}>
            <Text style={styles.phaseText}>{phaseLabel}</Text>
          </View>
        </View>

        <View style={styles.bottom}>
          <Text style={styles.city}>{activeStop.city}</Text>
          <Text style={styles.subtitle}>
            {formatDateRange(activeStop.dates.start, activeStop.dates.end)} · {activeStop.city}, {activeStop.region}
          </Text>
        </View>
      </Animated.View>

      {/* Compact strip — fades in as hero shrinks, pinned to bottom */}
      <Animated.View style={[styles.compactStrip, compactStyle]}>
        <Text style={styles.compactCity}>
          {visibleStop.emoji}{'  '}{visibleStop.city}
        </Text>
        <View style={styles.phasePill}>
          <Text style={styles.phaseText}>{phaseLabel}</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomLeftRadius: Radius.hero,
    borderBottomRightRadius: Radius.hero,
    marginBottom: -4,
    overflow: 'hidden',
  },
  gradient: {},
  expandedContent: {
    flex: 1,
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
  compactStrip: {
    position: 'absolute',
    bottom: Spacing.xl,
    left: Spacing.base,
    right: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactCity: {
    ...Typography.roles.h3,
    color: '#FFFFFF',
  },
});
