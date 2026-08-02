import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';
import type { StopWithColor } from '@/src/types';
import { Core, Semantic, Typography, Radius, Shadow } from '@/src/design/tokens';
import { formatDateRange } from '@/src/utils/dates';
import { hexWithAlpha } from '@/src/utils/colors';

interface StopsStripProps {
  stops: StopWithColor[];
  activeStopId: string | null;
  onStopPress: (stopId: string) => void;
  /** Optional — when provided, a trailing "+" pill is rendered after the last stop. */
  onAddPress?: () => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const STRIP_HEIGHT = 76;
const H_PADDING    = 20;
const PILL_WIDTH   = 170;   // minWidth of active pill — keep in sync with styles.activePill
const DOT_WIDTH    = 56;    // fixed width of each non-active stop slot
const CONN_WIDTH   = 40;    // fixed width of each connector segment
const MUTED_LINE   = 'rgba(120,113,106,0.18)';

// Horizontal translation that centers the active pill (at idx) within the strip
function computeOffset(idx: number): number {
  return (SCREEN_WIDTH - PILL_WIDTH) / 2 - H_PADDING - idx * (DOT_WIDTH + CONN_WIDTH);
}

const SPRING = { damping: 40, stiffness: 320 } as const;

export function StopsStrip({ stops, activeStopId, onStopPress, onAddPress }: StopsStripProps) {
  const activeIdx  = stops.findIndex(s => s.id === activeStopId);
  const safeIdx    = activeIdx >= 0 ? activeIdx : 0;
  // `stops[safeIdx]` is legitimately undefined when `stops` is empty (safeIdx falls back to 0,
  // which is out of bounds on an empty array) — every read of `activeStop` below must go through
  // optional chaining rather than assuming it's always a Stop.
  const activeStop = stops[safeIdx];

  const translateX   = useSharedValue(computeOffset(safeIdx));
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    translateX.value = withSpring(computeOffset(safeIdx), SPRING);
  }, [safeIdx]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.row, animatedStyle]}>
        {stops.map((stop, idx) => {
          const isActive = stop.id === activeStopId;
          const isPast   = safeIdx >= 0 && idx < safeIdx;
          // Segment before this stop is colored once we've reached or passed it
          const segmentColored = safeIdx > 0 && idx <= safeIdx;

          return (
            <React.Fragment key={stop.id}>
              {idx > 0 && (
                <View
                  style={[
                    styles.connector,
                    {
                      backgroundColor: segmentColored
                        ? hexWithAlpha(activeStop?.color ?? '#000', 0.55)
                        : MUTED_LINE,
                    },
                  ]}
                />
              )}

              <TouchableOpacity
                onPress={() => onStopPress(stop.id)}
                activeOpacity={isActive ? 0.85 : 0.7}
              >
                {isActive ? (
                  <View
                    style={[
                      styles.activePill,
                      {
                        borderColor: hexWithAlpha(stop.color, 0.28),
                        ...Shadow.cardResting,
                        shadowColor: stop.color,
                      },
                    ]}
                  >
                    <View style={[styles.activeEmojiCircle, { backgroundColor: hexWithAlpha(stop.color, 0.14) }]}>
                      <Text style={styles.activeEmoji}>{stop.emoji}</Text>
                    </View>
                    <View>
                      <Text style={[styles.activeCity, { color: stop.color }]}>{stop.city}</Text>
                      <Text style={styles.activeDates}>{formatDateRange(stop.dates.start, stop.dates.end)}</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.dotStop}>
                    <View style={[styles.dot, isPast ? styles.dotPast : styles.dotFuture]}>
                      <Text style={styles.dotEmoji}>{stop.emoji}</Text>
                    </View>
                    <Text
                      style={[styles.dotName, isPast ? styles.dotNamePast : styles.dotNameFuture]}
                      numberOfLines={1}
                    >
                      {stop.city}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </React.Fragment>
          );
        })}

        {onAddPress && (
          <React.Fragment>
            {stops.length > 0 && <View style={[styles.connector, { backgroundColor: MUTED_LINE }]} />}
            <TouchableOpacity
              testID="stops-strip-add-pill"
              onPress={onAddPress}
              activeOpacity={0.7}
            >
              <View style={styles.dotStop}>
                <View style={[styles.dot, styles.addDot]}>
                  <Text style={styles.addIcon}>+</Text>
                </View>
                <Text style={[styles.dotName, styles.dotNameFuture]} numberOfLines={1}>Add</Text>
              </View>
            </TouchableOpacity>
          </React.Fragment>
        )}
      </Animated.View>

      {/* Fade masks — clip overflow stops without hard edges */}
      <LinearGradient
        colors={['rgba(252,250,247,0.95)', 'rgba(252,250,247,0)']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.fadeLeft}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(252,250,247,0)', 'rgba(252,250,247,0.95)']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.fadeRight}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: STRIP_HEIGHT,
    backgroundColor: 'rgba(252,250,247,0.95)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Core.border,
    paddingHorizontal: H_PADDING,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connector: {
    width: CONN_WIDTH,
    height: 2,
  },
  // Active stop — expanded pill, width kept at PILL_WIDTH constant above
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: Core.surface,
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingLeft: 7,
    paddingRight: 14,
    paddingVertical: 7,
    width: PILL_WIDTH,
  },
  activeEmojiCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeEmoji: { fontSize: 21 },
  activeCity:  { ...Typography.roles.label, fontWeight: '700' as const },
  activeDates: { ...Typography.roles.meta, color: Core.textMuted, marginTop: 2 },
  // Dot stops (past / future), width kept at DOT_WIDTH constant above
  dotStop: {
    alignItems: 'center',
    gap: 5,
    width: DOT_WIDTH,
  },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  dotPast:       { backgroundColor: 'rgba(62,123,82,0.12)',   borderColor: 'rgba(62,123,82,0.32)' },
  dotFuture:     { backgroundColor: 'rgba(120,113,106,0.08)', borderColor: 'rgba(120,113,106,0.22)' },
  dotEmoji:      { fontSize: 15 },
  addDot:        { backgroundColor: 'rgba(120,113,106,0.08)', borderColor: 'rgba(120,113,106,0.32)', borderStyle: 'dashed' },
  addIcon:       { fontSize: 17, fontWeight: '600' as const, color: Core.textMuted },
  dotName:       { ...Typography.roles.meta, fontSize: 11, fontWeight: '600' as const, textAlign: 'center' },
  dotNamePast:   { color: Semantic.success },
  dotNameFuture: { color: Core.textFaint },
  fadeLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 28,
    zIndex: 10,
  },
  fadeRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 28,
    zIndex: 10,
  },
});
