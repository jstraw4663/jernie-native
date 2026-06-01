import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Stop } from '@/src/types';
import { Core, Semantic, Typography, Radius, Shadow } from '@/src/design/tokens';
import { formatDateRange } from '@/src/utils/dates';
import { hexWithAlpha } from '@/src/utils/colors';

interface StopsStripProps {
  stops: Stop[];
  activeStopId: string | null;
  onStopPress: (stopId: string) => void;
}

const STRIP_HEIGHT = 76;
const H_PADDING    = 20;
const MUTED_LINE   = 'rgba(120,113,106,0.18)';

export function StopsStrip({ stops, activeStopId, onStopPress }: StopsStripProps) {
  const activeIdx  = stops.findIndex(s => s.id === activeStopId);
  const activeStop = stops[activeIdx] ?? stops[0];

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {stops.map((stop, idx) => {
          const isActive = stop.id === activeStopId;
          const isPast   = activeIdx >= 0 && idx < activeIdx;
          // Segment before this stop is colored when we've reached or passed it
          const segmentColored = activeIdx > 0 && idx <= activeIdx;

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
      </View>
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
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  // Connector line segment between two adjacent stops
  connector: {
    flex: 1,
    height: 2,
  },
  // Active stop — expanded pill
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
    minWidth: 160,
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
  // Dot stops (past / future)
  dotStop: {
    alignItems: 'center',
    gap: 5,
    width: 56,
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
  dotName:       { ...Typography.roles.meta, fontSize: 11, fontWeight: '600' as const, textAlign: 'center' },
  dotNamePast:   { color: Semantic.success },
  dotNameFuture: { color: Core.textFaint },
});
