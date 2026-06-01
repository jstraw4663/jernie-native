import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Stop, Booking, ItineraryDay } from '@/src/types';
import { Core, Typography, Radius, Spacing } from '@/src/design/tokens';
import { formatDateRange } from '@/src/utils/dates';
import { hexWithAlpha } from '@/src/utils/colors';
import { TravelCard } from './components/TravelCard';
import { ItineraryDayRow } from './components/ItineraryDayRow';

interface StopSectionProps {
  stop: Stop;
  bookings: Booking[];
  days: ItineraryDay[];
  expandedDayId: string | null;
  onDayPress: (dayId: string | null) => void;
}

export function StopSection({
  stop, bookings, days, expandedDayId, onDayPress,
}: StopSectionProps) {
  return (
    <View>
      {/* Stop header — tinted rounded card */}
      <View
        style={[
          styles.headerCard,
          {
            backgroundColor: hexWithAlpha(stop.color, 0.07),
            borderColor:     hexWithAlpha(stop.color, 0.18),
          },
        ]}
      >
        <View style={[styles.emojiSquare, { backgroundColor: hexWithAlpha(stop.color, 0.15) }]}>
          <Text style={styles.emoji}>{stop.emoji}</Text>
        </View>
        <View>
          <Text style={styles.cityName}>{stop.city}</Text>
          <Text style={styles.dates}>{formatDateRange(stop.dates.start, stop.dates.end)}</Text>
        </View>
      </View>

      {/* Travel cards — pass stopColor for tinted hotel/rental cards */}
      {bookings.map(booking => (
        <TravelCard key={booking.id} booking={booking} stopColor={stop.color} />
      ))}

      {/* Day cards — grouped with gap */}
      <View style={styles.daysWrapper}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.xl,
    margin: Spacing.sm,
    marginTop: Spacing.base,
    padding: Spacing.md,
  },
  emojiSquare: {
    width: 34,
    height: 34,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji:    { fontSize: 18 },
  cityName: { ...Typography.roles.h2Bold, color: Core.text },
  dates:    { ...Typography.roles.meta,   color: Core.textMuted, marginTop: 2 },
  daysWrapper: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.sm,
    marginBottom: Spacing.base,
    gap: 6,
  },
});
