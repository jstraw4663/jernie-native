import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { StopWithColor, Booking, ItineraryDay, ItineraryItem } from '@/src/types';
import { Core, Typography, Spacing } from '@/src/design/tokens';
import { TravelCard } from './components/TravelCard';
import { ItineraryDayRow } from './components/ItineraryDayRow';

interface StopSectionProps {
  stop: StopWithColor;
  bookings: Booking[];
  days: ItineraryDay[];
  expandedDayId: string | null;
  onDayPress: (dayId: string | null) => void;
  onBookingPress?: (booking: Booking) => void;
  onItemPress?: (item: ItineraryItem) => void;
}

function SectionLabel({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

export function StopSection({
  stop, bookings, days, expandedDayId, onDayPress, onBookingPress, onItemPress,
}: StopSectionProps) {
  return (
    <View style={styles.container}>
      {/* Travel bookings */}
      {bookings.map(booking => (
        <TravelCard
          key={booking.id}
          booking={booking}
          stopColor={stop.color}
          stopCity={stop.city}
          onPress={onBookingPress ? () => onBookingPress(booking) : undefined}
        />
      ))}

      {/* Itinerary — day cards */}
      {days.length > 0 && (
        <>
          <SectionLabel title="Itinerary" />
          <View style={styles.daysWrapper}>
            {days.map((day, idx) => (
              <ItineraryDayRow
                key={day.id}
                day={day}
                dayNumber={idx + 1}
                stopColor={stop.color}
                isExpanded={expandedDayId === day.id}
                onPress={() => onDayPress(expandedDayId === day.id ? null : day.id)}
                onItemPress={onItemPress}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: Spacing.base,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  sectionLabel: {
    ...Typography.roles.labelCaps,
    color: Core.textFaint,
  },
  sectionLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Core.border,
  },
  daysWrapper: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    gap: Spacing.sm,
  },
});
