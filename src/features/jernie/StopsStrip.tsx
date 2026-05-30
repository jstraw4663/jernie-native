import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Stop } from '@/src/types';
import { Core, Semantic, Typography, Radius, Spacing } from '@/src/design/tokens';

interface StopsStripProps {
  stops: Stop[];
  activeStopId: string | null;
  onStopPress: (stopId: string) => void;
}

type StopState = 'active' | 'past' | 'future';

function getStopState(stop: Stop, activeStopId: string | null, stops: Stop[]): StopState {
  if (stop.id === activeStopId) return 'active';
  const activeIdx = stops.findIndex(s => s.id === activeStopId);
  const myIdx = stops.findIndex(s => s.id === stop.id);
  if (activeIdx >= 0 && myIdx < activeIdx) return 'past';
  return 'future';
}

function formatDateRange(start: string, end: string): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  return `${months[s.getMonth()]} ${s.getDate()}–${e.getDate()}`;
}

export function StopsStrip({ stops, activeStopId, onStopPress }: StopsStripProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {stops.map(stop => {
          const state = getStopState(stop, activeStopId, stops);
          const isActive = state === 'active';
          return (
            <TouchableOpacity
              key={stop.id}
              onPress={() => onStopPress(stop.id)}
              activeOpacity={0.75}
              style={[
                styles.pill,
                state === 'past'   && styles.pillPast,
                state === 'future' && styles.pillFuture,
                isActive && {
                  borderColor: stop.color,
                  backgroundColor: stop.color + '1A',
                  minWidth: 160,
                },
              ]}
            >
              <Text style={styles.pillEmoji}>{stop.emoji}</Text>
              <Text style={[
                styles.pillCity,
                isActive           && { color: stop.color },
                state === 'past'   && styles.textPast,
                state === 'future' && styles.textFuture,
              ]}>
                {stop.city}
              </Text>
              <Text style={[
                styles.pillDate,
                isActive           && { color: stop.color },
                state === 'past'   && styles.textPast,
                state === 'future' && styles.textFuture,
              ]}>
                {formatDateRange(stop.dates.start, stop.dates.end)}
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Core.border,
    backgroundColor: 'rgba(252,250,247,0.95)',
  },
  scrollContent: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  pillPast:   { backgroundColor: Semantic.successTint },
  pillFuture: { backgroundColor: Core.surfaceMuted },
  pillEmoji:  { fontSize: 14 },
  pillCity:   { ...Typography.roles.label, color: Core.text },
  pillDate:   { ...Typography.roles.meta,  color: Core.textMuted },
  textPast:   { color: Core.textMuted },
  textFuture: { color: Core.textFaint },
});
