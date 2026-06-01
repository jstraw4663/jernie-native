import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Dimensions,
} from 'react-native';
import type { Stop } from '@/src/types';
import { Core, Semantic, Typography, Radius, Shadow } from '@/src/design/tokens';
import { formatDateRange } from '@/src/utils/dates';
import { hexWithAlpha } from '@/src/utils/colors';

interface StopsStripProps {
  stops: Stop[];
  activeStopId: string | null;
  onStopPress: (stopId: string) => void;
}

type StopState = 'active' | 'past' | 'future';

function getStopState(stop: Stop, activeStopId: string | null, stops: Stop[]): StopState {
  if (stop.id === activeStopId) return 'active';
  const activeIdx = stops.findIndex(s => s.id === activeStopId);
  const myIdx     = stops.findIndex(s => s.id === stop.id);
  if (activeIdx >= 0 && myIdx < activeIdx) return 'past';
  return 'future';
}

const STRIP_HEIGHT = 76;
const H_PADDING    = 28;

export function StopsStrip({ stops, activeStopId, onStopPress }: StopsStripProps) {
  const [trackWidth, setTrackWidth] = useState(
    () => Dimensions.get('window').width - H_PADDING * 2,
  );

  const activeIdx  = stops.findIndex(s => s.id === activeStopId);
  const activeStop = stops[activeIdx] ?? stops[0];
  const ratio      = stops.length > 1 ? Math.max(0, activeIdx) / (stops.length - 1) : 0;
  const progressW  = trackWidth * ratio;

  return (
    <View
      style={styles.container}
      onLayout={e => setTrackWidth(e.nativeEvent.layout.width - H_PADDING * 2)}
    >
      {/* Connector track line — fixed behind scroll content (JSX order = paint order) */}
      <View style={styles.trackLine} pointerEvents="none" />

      {/* Colored progress line up to active stop */}
      {activeStop && (
        <View
          style={[
            styles.progressLine,
            {
              width: progressW,
              backgroundColor: activeStop.color,
              shadowColor: activeStop.color,
            },
          ]}
          pointerEvents="none"
        />
      )}

      {/* Scrollable stop items painted on top */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={StyleSheet.absoluteFill}
      >
        {stops.map(stop => {
          const state = getStopState(stop, activeStopId, stops);

          if (state === 'active') {
            return (
              <TouchableOpacity
                key={stop.id}
                onPress={() => onStopPress(stop.id)}
                activeOpacity={0.8}
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
              </TouchableOpacity>
            );
          }

          const isPast = state === 'past';
          return (
            <TouchableOpacity
              key={stop.id}
              onPress={() => onStopPress(stop.id)}
              activeOpacity={0.7}
              style={styles.dotStop}
            >
              <View style={[styles.dot, isPast ? styles.dotPast : styles.dotFuture]}>
                <Text style={styles.dotEmoji}>{stop.emoji}</Text>
              </View>
              <Text
                style={[styles.dotName, isPast ? styles.dotNamePast : styles.dotNameFuture]}
                numberOfLines={1}
              >
                {stop.city}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
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
  },
  trackLine: {
    position: 'absolute',
    left: H_PADDING,
    right: H_PADDING,
    top: STRIP_HEIGHT / 2 - 1,
    height: 2,
    backgroundColor: 'rgba(120,113,106,0.18)',
  },
  progressLine: {
    position: 'absolute',
    left: H_PADDING,
    top: STRIP_HEIGHT / 2 - 1,
    height: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.38,
    shadowRadius: 4,
    elevation: 2,
  },
  scrollContent: {
    paddingHorizontal: H_PADDING,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: STRIP_HEIGHT,
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
    minWidth: 172,
  },
  activeEmojiCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeEmoji:  { fontSize: 21 },
  activeCity:   { ...Typography.roles.label, fontWeight: '700' as const },
  activeDates:  { ...Typography.roles.meta, color: Core.textMuted, marginTop: 2 },
  // Dot stops (past / future)
  dotStop: {
    alignItems: 'center',
    gap: 5,
    width: 70,
  },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  dotPast:   { backgroundColor: 'rgba(62,123,82,0.12)',  borderColor: 'rgba(62,123,82,0.32)' },
  dotFuture: { backgroundColor: 'rgba(120,113,106,0.08)', borderColor: 'rgba(120,113,106,0.22)' },
  dotEmoji:      { fontSize: 15 },
  dotName:       { ...Typography.roles.meta, fontSize: 11, fontWeight: '600' as const, textAlign: 'center' },
  dotNamePast:   { color: Semantic.success },
  dotNameFuture: { color: Core.textFaint },
});
