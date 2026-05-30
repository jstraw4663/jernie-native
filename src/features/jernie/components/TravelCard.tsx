import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Booking, BookingType } from '@/src/types';
import { Core, TypeColors, Typography, Radius, Shadow, Spacing } from '@/src/design/tokens';

const BOOKING_TYPE_COLOR: Record<BookingType, string> = {
  flight:     TypeColors.flight,
  hotel:      TypeColors.stay,
  rental:     TypeColors.car,
  restaurant: TypeColors.food,
};

interface TravelCardProps {
  booking: Booking;
}

export function TravelCard({ booking }: TravelCardProps) {
  const accentColor = BOOKING_TYPE_COLOR[booking.type];
  return (
    <View style={[styles.card, Shadow.cardResting]}>
      <View style={[styles.accent, { backgroundColor: accentColor }]} />
      <View style={styles.content}>
        {booking.type === 'flight'  && <FlightContent  booking={booking} />}
        {booking.type === 'hotel'   && <HotelContent   booking={booking} />}
        {booking.type === 'rental'  && <RentalContent  booking={booking} />}
      </View>
    </View>
  );
}

function FlightContent({ booking }: { booking: Extract<Booking, { type: 'flight' }> }) {
  return (
    <>
      <Text style={styles.label}>{booking.airline} · {booking.flightNumber}</Text>
      <Text style={styles.h3}>{booking.origin} → {booking.destination}</Text>
      <View style={styles.row}>
        <Text style={styles.mono}>{booking.departureTime}</Text>
        <Text style={styles.monoFaint}> – </Text>
        <Text style={styles.mono}>{booking.arrivalTime}</Text>
      </View>
      <View style={[styles.statusPill, { backgroundColor: '#D1F0DF' }]}>
        <Text style={[styles.statusText, { color: '#3E7B52' }]}>On time</Text>
      </View>
    </>
  );
}

function HotelContent({ booking }: { booking: Extract<Booking, { type: 'hotel' }> }) {
  const nights = daysBetween(booking.checkIn, booking.checkOut);
  return (
    <>
      <Text style={styles.h3}>{booking.hotelName}</Text>
      <Text style={styles.meta}>{shortDate(booking.checkIn)} – {shortDate(booking.checkOut)}</Text>
      <Text style={styles.mono}>{nights} night{nights !== 1 ? 's' : ''}</Text>
    </>
  );
}

function RentalContent({ booking }: { booking: Extract<Booking, { type: 'rental' }> }) {
  return (
    <>
      <Text style={styles.h3}>{booking.pickupLocation}</Text>
      <Text style={styles.meta}>{shortDate(booking.pickupDate)} – {shortDate(booking.dropoffDate)}</Text>
      <Text style={styles.meta}>
        {booking.company}{booking.carType ? ` · ${booking.carType}` : ''}
      </Text>
    </>
  );
}

function daysBetween(start: string, end: string): number {
  const a = new Date(start + 'T12:00:00');
  const b = new Date(end + 'T12:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function shortDate(iso: string): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date(iso + 'T12:00:00');
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: Radius.list,
    backgroundColor: Core.surface,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  accent: { width: 3 },
  content: { flex: 1, padding: Spacing.md },
  label:      { ...Typography.roles.label,     color: Core.textMuted, marginBottom: 2 },
  h3:         { ...Typography.roles.h3,        color: Core.text,      marginBottom: 4 },
  meta:       { ...Typography.roles.meta,      color: Core.textMuted, marginBottom: 2 },
  row:        { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  mono:       { ...Typography.roles.mono,      color: Core.text },
  monoFaint:  { ...Typography.roles.mono,      color: Core.textMuted },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    marginTop: 4,
  },
  statusText: { ...Typography.roles.labelCaps },
});
