import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Trip, StopWithColor } from '@/src/types';
import { Typography, Radius, Spacing, Semantic } from '@/src/design/tokens';
import { formatDateRange } from '@/src/utils/dates';
import { getDevNow } from '@/src/utils/devTime';
import { stopHeroGradient } from '@/src/utils/colors';

interface HeroLayerProps {
  trip: Trip;
  activeStop: StopWithColor;              // date-based — drives phase pill label
  visibleStop?: StopWithColor;            // scroll-position — drives compact strip city/emoji (optional)
  scrollY?: SharedValue<number>; // when omitted, hero renders at full height without animation
  /** When provided, a `···` control renders top-right; pressing it should open the stop editor. */
  onEditStop?: () => void;
}

export function HeroLayer({ trip, activeStop, visibleStop, scrollY, onEditStop }: HeroLayerProps) {
  const effectiveVisibleStop = visibleStop ?? activeStop;
  const _fallbackScrollY = useSharedValue(0);
  const effectiveScrollY = scrollY ?? _fallbackScrollY;
  const insets = useSafeAreaInsets();

  const todayIso = getDevNow().toISOString().split('T')[0];
  const phaseLabel =
    todayIso < activeStop.dates.start ? 'Pre-trip' :
    todayIso < activeStop.dates.end   ? 'In trip'  :
                                         'Post-trip';

  // Animated container height: 280px → 120px
  const heroStyle = useAnimatedStyle(() => ({
    height: interpolate(effectiveScrollY.value, [0, 120], [280, 120], Extrapolation.CLAMP),
  }));

  // Expanded content (pills + large city + subtitle): fades out 0→80
  const expandedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(effectiveScrollY.value, [0, 80], [1, 0], Extrapolation.CLAMP),
  }));

  // Compact strip (emoji + city + phase pill): fades in 80→120
  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(effectiveScrollY.value, [80, 120], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View style={[styles.container, heroStyle]}>
      {/* LinearGradient derived from the currently viewed stop's color */}
      <LinearGradient
        colors={stopHeroGradient(effectiveVisibleStop.color)}
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
            <View style={styles.phaseDot} />
            <Text style={styles.phaseText}>{phaseLabel}</Text>
          </View>
          {onEditStop && (
            <TouchableOpacity
              testID="hero-edit-button"
              accessibilityRole="button"
              accessibilityLabel="Edit stop"
              style={styles.editButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={onEditStop}
            >
              <Text style={styles.editGlyph}>···</Text>
            </TouchableOpacity>
          )}
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
        <View style={styles.compactMark}>
          <Text style={styles.compactEmoji}>{effectiveVisibleStop.emoji}</Text>
        </View>
        <View>
          <Text style={styles.compactPlace}>Current stop</Text>
          <Text style={styles.compactCity}>{effectiveVisibleStop.city}</Text>
          <Text style={styles.compactMeta}>{phaseLabel}</Text>
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
  expandedContent: {
    flex: 1,
    paddingHorizontal: Spacing.base,
    justifyContent: 'space-between',
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tripPill: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tripPillText: {
    ...Typography.roles.label,
    color: 'rgba(255,255,255,0.9)',
  },
  phasePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Semantic.warningTint,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  phaseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Semantic.warning,
  },
  phaseText: {
    ...Typography.roles.label,
    color: Semantic.warning,
  },
  editButton: {
    marginLeft: 'auto',
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editGlyph: {
    ...Typography.roles.label,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 14,
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
    bottom: Spacing.base,
    left: Spacing.base,
    right: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  compactMark: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  compactEmoji: { fontSize: 18 },
  compactPlace: {
    fontSize: 10,
    fontFamily: 'DMSans',
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
  },
  compactCity: {
    fontSize: 15,
    fontFamily: 'DMSans',
    fontWeight: '800',
    letterSpacing: -0.3,
    color: '#FFFFFF',
  },
  compactMeta: {
    fontSize: 11,
    fontFamily: 'DMSans',
    color: 'rgba(255,255,255,0.60)',
    marginTop: 1,
  },
});
