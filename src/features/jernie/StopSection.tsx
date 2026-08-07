import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { StopWithColor, Booking, BookingType, ItineraryDay, ItineraryItem } from '@/src/types';
import { Core, Typography, Radius, Spacing } from '@/src/design/tokens';
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
  /** When provided, each booking type gets a "+" affordance that opens the booking form. */
  onAddBooking?: (type: BookingType) => void;
}

// Fixed display order, so a stop's sections don't reshuffle as bookings are added.
const BOOKING_GROUPS: Array<{ type: BookingType; title: string }> = [
  { type: 'flight',     title: 'Flights'     },
  { type: 'hotel',      title: 'Stays'       },
  { type: 'rental',     title: 'Rental cars' },
  { type: 'restaurant', title: 'Restaurants' },
];

function SectionLabel({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.sectionLine} />
      {action}
    </View>
  );
}

function AddPill({ testID, label, onPress }: { testID: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      testID={testID}
      style={styles.addPill}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      onPress={onPress}
    >
      <Text style={styles.addPillText}>+ {label}</Text>
    </TouchableOpacity>
  );
}

export function StopSection({
  stop, bookings, days, expandedDayId, onDayPress, onBookingPress, onItemPress, onAddBooking,
}: StopSectionProps) {
  const grouped = BOOKING_GROUPS.map(group => ({
    ...group,
    bookings: bookings.filter(b => b.type === group.type),
  }));
  // Types with nothing booked yet get a pill in the trailing row rather than an empty section,
  // so all four stay reachable from every stop without four empty headers.
  const emptyGroups = grouped.filter(g => g.bookings.length === 0);

  return (
    <View style={styles.container}>
      {/* Travel bookings, grouped by type so each group carries its own add control */}
      {grouped.map(group => group.bookings.length === 0 ? null : (
        <React.Fragment key={group.type}>
          <SectionLabel
            title={group.title}
            action={onAddBooking && (
              <AddPill
                testID={`add-booking-${group.type}`}
                label="Add"
                onPress={() => onAddBooking(group.type)}
              />
            )}
          />
          {group.bookings.map(booking => (
            <TravelCard
              key={booking.id}
              booking={booking}
              stopId={stop.id}
              stopColor={stop.color}
              stopCity={stop.city}
              onPress={onBookingPress ? () => onBookingPress(booking) : undefined}
            />
          ))}
        </React.Fragment>
      ))}

      {onAddBooking && emptyGroups.length > 0 && (
        <View style={styles.emptyAddRow}>
          {emptyGroups.map(group => (
            <AddPill
              key={group.type}
              testID={`add-booking-${group.type}`}
              label={group.title}
              onPress={() => onAddBooking(group.type)}
            />
          ))}
        </View>
      )}

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
  addPill: {
    borderWidth: 1,
    borderColor: Core.border,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  addPillText: {
    ...Typography.roles.labelCaps,
    color: Core.textMuted,
  },
  emptyAddRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
  },
  daysWrapper: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    gap: Spacing.sm,
  },
});
