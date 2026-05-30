import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Stop, Booking, ItineraryDay } from '@/src/types';
import { Core, Typography, Spacing } from '@/src/design/tokens';
import { TravelCard } from './components/TravelCard';
import { ItineraryDayRow } from './components/ItineraryDayRow';

interface StopSectionProps {
  stop: Stop;
  bookings: Booking[];
  days: ItineraryDay[];
  expandedDayId: string | null;
  onDayPress: (dayId: string | null) => void;
  onSectionLayout: (y: number) => void;
}

export function StopSection({
  stop,
  bookings,
  days,
  expandedDayId,
  onDayPress,
  onSectionLayout,
}: StopSectionProps) {
  return (
    <View onLayout={e => onSectionLayout(e.nativeEvent.layout.y)}>
      <View style={[styles.sectionHeader, { borderLeftColor: stop.color }]}>
        <Text style={styles.emoji}>{stop.emoji}</Text>
        <Text style={styles.cityName}>{stop.city}</Text>
      </View>

      {bookings.map(booking => (
        <TravelCard key={booking.id} booking={booking} />
      ))}

      {days.map((day, idx) => (
        <ItineraryDayRow
          key={day.id}
          day={day}
          dayNumber={idx + 1}
          stopColor={stop.color}
          isExpanded={expandedDayId === day.id}
          onPress={() => onDayPress(expandedDayId === day.id ? null : day.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderLeftWidth: 3,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.base,
    marginTop: Spacing.base,
    backgroundColor: Core.bg,
  },
  emoji:    { fontSize: 20 },
  cityName: { ...Typography.roles.h2Bold, color: Core.text },
});
