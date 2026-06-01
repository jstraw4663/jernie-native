import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Booking } from '@/src/types';
import { Brand, Core, TypeColors, Typography, Radius, Shadow, Spacing } from '@/src/design/tokens';
import { hexWithAlpha } from '@/src/utils/colors';

interface TravelCardProps {
  booking: Booking;
  stopColor: string;
}

export function TravelCard({ booking, stopColor }: TravelCardProps) {
  if (booking.type === 'flight')     return <FlightCard booking={booking} />;
  if (booking.type === 'hotel')      return <HotelCard  booking={booking} stopColor={stopColor} />;
  if (booking.type === 'rental')     return <RentalCard booking={booking} stopColor={stopColor} />;
  if (booking.type === 'restaurant') return <RestaurantCard booking={booking} />;
  return null;
}

// ── Flight card — dark navy gradient ──────────────────────────────────────────

function FlightCard({ booking }: { booking: Extract<Booking, { type: 'flight' }> }) {
  return (
    <View style={[styles.flightCard, Shadow.cardHover]}>
      <View style={styles.flightTop}>
        <Text style={styles.flightTag}>{booking.airline} · {booking.flightNumber}</Text>
        <View style={styles.onTimeChip}>
          <Text style={styles.onTimeText}>On time</Text>
        </View>
      </View>

      <View style={styles.flightRoute}>
        <View style={styles.routeEndpoint}>
          <Text style={styles.airportCode}>{booking.origin}</Text>
          <Text style={styles.flightTime}>{booking.departureTime}</Text>
        </View>
        <Text style={styles.routeArrow}>→</Text>
        <View style={[styles.routeEndpoint, styles.routeEndpointRight]}>
          <Text style={styles.airportCode}>{booking.destination}</Text>
          <Text style={styles.flightTime}>{booking.arrivalTime}</Text>
        </View>
      </View>

      {booking.confirmationCode && (
        <View style={styles.flightFooter}>
          <Text style={styles.flightFooterLabel}>Confirmation</Text>
          <Text style={styles.flightFooterValue}>{booking.confirmationCode}</Text>
        </View>
      )}
    </View>
  );
}

// ── Hotel card — stop-color tinted surface ────────────────────────────────────

function HotelCard({ booking, stopColor }: { booking: Extract<Booking, { type: 'hotel' }>, stopColor: string }) {
  const nights = daysBetween(booking.checkIn, booking.checkOut);
  return (
    <View
      style={[
        styles.surfaceCard,
        { borderColor: hexWithAlpha(stopColor, 0.18) },
      ]}
    >
      <View style={[styles.typeIcon, { backgroundColor: hexWithAlpha(stopColor, 0.12) }]}>
        <Text style={styles.typeEmoji}>🏨</Text>
      </View>
      <View style={styles.surfaceCardBody}>
        <Text style={styles.surfaceCardName}>{booking.hotelName}</Text>
        <Text style={styles.surfaceCardMeta}>
          {shortDate(booking.checkIn)} – {shortDate(booking.checkOut)}
        </Text>
        <Text style={[styles.surfaceCardAccent, { color: stopColor }]}>
          {nights} night{nights !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  );
}

// ── Rental card — stop-color tinted surface ───────────────────────────────────

function RentalCard({ booking, stopColor }: { booking: Extract<Booking, { type: 'rental' }>, stopColor: string }) {
  return (
    <View
      style={[
        styles.surfaceCard,
        { borderColor: hexWithAlpha(stopColor, 0.18) },
      ]}
    >
      <View style={[styles.typeIcon, { backgroundColor: hexWithAlpha(stopColor, 0.12) }]}>
        <Text style={styles.typeEmoji}>🚗</Text>
      </View>
      <View style={styles.surfaceCardBody}>
        <Text style={styles.surfaceCardName}>
          {booking.company}{booking.carType ? ` · ${booking.carType}` : ''}
        </Text>
        <Text style={styles.surfaceCardMeta}>
          {shortDate(booking.pickupDate)} – {shortDate(booking.dropoffDate)}
        </Text>
        <Text style={styles.surfaceCardMeta}>{booking.pickupLocation}</Text>
      </View>
    </View>
  );
}

// ── Restaurant card — food-color tinted surface ───────────────────────────────

function RestaurantCard({ booking }: { booking: Extract<Booking, { type: 'restaurant' }> }) {
  const foodColor = TypeColors.food;
  return (
    <View
      style={[
        styles.surfaceCard,
        { borderColor: hexWithAlpha(foodColor, 0.18) },
      ]}
    >
      <View style={[styles.typeIcon, { backgroundColor: hexWithAlpha(foodColor, 0.10) }]}>
        <Text style={styles.typeEmoji}>🍽️</Text>
      </View>
      <View style={styles.surfaceCardBody}>
        <Text style={styles.surfaceCardName}>{booking.restaurantName}</Text>
        <Text style={styles.surfaceCardMeta}>{shortDate(booking.date)}{booking.time ? ` · ${booking.time}` : ''}</Text>
        {booking.partySize && (
          <Text style={[styles.surfaceCardAccent, { color: foodColor }]}>
            Party of {booking.partySize}
          </Text>
        )}
      </View>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysBetween(start: string, end: string): number {
  const a = new Date(start + 'T12:00:00');
  const b = new Date(end   + 'T12:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function shortDate(iso: string): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date(iso + 'T12:00:00');
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Flight card
  flightCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    borderRadius: 18,
    backgroundColor: Brand.navy,
    padding: 14,
  },
  flightTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  flightTag: {
    ...Typography.roles.labelCaps,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.8,
  },
  onTimeChip: {
    height: 20,
    paddingHorizontal: 8,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(62,123,82,0.30)',
    borderWidth: 1,
    borderColor: 'rgba(100,200,140,0.30)',
    justifyContent: 'center',
  },
  onTimeText: {
    ...Typography.roles.labelCaps,
    color: '#a0f0c0',
    letterSpacing: 0.5,
  },
  flightRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  routeEndpoint: { flex: 1, alignItems: 'flex-start' },
  routeEndpointRight: { alignItems: 'flex-end' },
  airportCode: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: Core.white,
    fontFamily: 'DMSans',
  },
  flightTime: {
    ...Typography.roles.label,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
  },
  routeArrow: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 8,
  },
  flightFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
  flightFooterLabel: {
    ...Typography.roles.labelCaps,
    color: 'rgba(255,255,255,0.40)',
    letterSpacing: 0.7,
  },
  flightFooterValue: {
    ...Typography.roles.label,
    color: 'rgba(255,255,255,0.90)',
  },
  // Surface cards (hotel, rental, restaurant)
  surfaceCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    borderRadius: Radius.xl,
    borderWidth: 1,
    backgroundColor: Core.surface,
    padding: Spacing.md,
    ...Shadow.cardResting,
  },
  typeIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  typeEmoji: { fontSize: 17 },
  surfaceCardBody:   { flex: 1 },
  surfaceCardName:   { ...Typography.roles.label, fontWeight: '700' as const, color: Core.text, marginBottom: 3 },
  surfaceCardMeta:   { ...Typography.roles.meta, color: Core.textMuted, marginBottom: 1 },
  surfaceCardAccent: { ...Typography.roles.label, marginTop: 3 },
});
