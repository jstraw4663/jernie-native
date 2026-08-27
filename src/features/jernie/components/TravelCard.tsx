import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Booking } from '@/src/types';
import { getFlightEndpoints, getFlightLegs } from '@/src/domain/bookings';
import { BedIcon } from 'phosphor-react-native/src/icons/Bed';
import { CarProfileIcon } from 'phosphor-react-native/src/icons/CarProfile';
import { ForkKnifeIcon } from 'phosphor-react-native/src/icons/ForkKnife';
import { Core, Radius, Shadow, Spacing, TypeColors, Typography } from '@/src/design/tokens';
import { hexWithAlpha } from '@/src/utils/colors';

interface TravelCardProps {
  booking: Booking;
  stopColor: string;
  stopCity?: string;
  // The stop this card is being rendered under — used by the rental variant to tell
  // pickup from drop-off when a rental's pickup/dropoff stops differ.
  stopId?: string;
  onPress?: () => void;
}

export function TravelCard({ booking, stopColor, stopCity, stopId, onPress }: TravelCardProps) {
  if (booking.type === 'flight')     return <FlightCard booking={booking} stopCity={stopCity} onPress={onPress} />;
  if (booking.type === 'hotel')      return <HotelCard  booking={booking} stopColor={stopColor} onPress={onPress} />;
  if (booking.type === 'rental')     return <RentalCard booking={booking} stopColor={stopColor} stopId={stopId} onPress={onPress} />;
  if (booking.type === 'restaurant') return <RestaurantCard booking={booking} onPress={onPress} />;
  return null;
}

// ── Flight card — dark navy gradient ──────────────────────────────────────────

function FlightCard({
  booking,
  stopCity,
  onPress,
}: {
  booking: Extract<Booking, { type: 'flight' }>;
  stopCity?: string;
  onPress?: () => void;
}) {
  // Overall route uses the first leg's origin and the last leg's destination;
  // each leg is also rendered as its own row below when there's more than one.
  const { firstLeg, lastLeg } = getFlightEndpoints(booking);
  const legs = getFlightLegs(booking);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.85 : 1} disabled={!onPress}>
      <LinearGradient
        colors={[TypeColors.flight, TypeColors.car]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.flightCard}
      >
        <View style={styles.flightTop}>
          <Text style={styles.flightTag}>{firstLeg.airline} · {firstLeg.flightNumber}</Text>
          <View style={styles.onTimeChip}>
            <Text style={styles.onTimeText}>On time</Text>
          </View>
        </View>

        <View style={styles.flightRoute}>
          <View style={styles.routeEndpoint}>
            <Text style={styles.airportCode}>{firstLeg.origin}</Text>
            <Text style={styles.flightTime}>{firstLeg.departureTime}</Text>
          </View>
          <Text style={styles.routeArrow}>→</Text>
          <View style={[styles.routeEndpoint, styles.routeEndpointRight]}>
            <Text style={styles.airportCode}>{lastLeg.destination}</Text>
            <Text style={styles.flightTime}>{lastLeg.arrivalTime}</Text>
            {stopCity && <Text style={styles.airportCity}>{stopCity}</Text>}
          </View>
        </View>

        {legs.length > 1 && (
          <View style={styles.legList}>
            {legs.map((leg, i) => (
              <Text key={i} style={styles.legRow}>
                {leg.origin} → {leg.destination} · {leg.departureTime} → {leg.arrivalTime}
              </Text>
            ))}
          </View>
        )}

        {booking.confirmationCode && (
          <View style={styles.flightFooter}>
            <View style={styles.flightFooterBlock}>
              <Text style={styles.flightFooterLabel}>Confirmation</Text>
              <Text style={styles.flightFooterValue}>{booking.confirmationCode}</Text>
            </View>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ── Hotel card — stop-color tinted surface ────────────────────────────────────

function HotelCard({ booking, stopColor, onPress }: { booking: Extract<Booking, { type: 'hotel' }>, stopColor: string, onPress?: () => void }) {
  const nights = daysBetween(booking.checkIn, booking.checkOut);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.85 : 1} disabled={!onPress}>
      <View
        style={[
          styles.surfaceCard,
          { borderColor: hexWithAlpha(stopColor, 0.18) },
        ]}
      >
        <View style={[styles.typeIcon, { backgroundColor: hexWithAlpha(stopColor, 0.12) }]}>
          <BedIcon size={16} color={stopColor} weight="fill" />
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
    </TouchableOpacity>
  );
}

// ── Rental card — stop-color tinted surface ───────────────────────────────────

function RentalCard({ booking, stopColor, stopId, onPress }: { booking: Extract<Booking, { type: 'rental' }>, stopColor: string, stopId?: string, onPress?: () => void }) {
  // Only cross-stop rentals (pickup in one stop, dropoff in another) are ambiguous
  // enough to need a badge — a same-stop rental has no "which end is this?" question.
  const isCrossStop = !!booking.dropoffStopId && booking.dropoffStopId !== booking.stopId;
  const isDropoffStopHere = !!stopId && stopId === booking.dropoffStopId;
  const badgeLabel =
    !isCrossStop ? null :
    isDropoffStopHere ? 'Drop-off here' :
    stopId === booking.stopId ? 'Pickup here' :
    null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
      disabled={!onPress}
      style={[
        styles.surfaceCard,
        { borderColor: hexWithAlpha(stopColor, 0.18) },
      ]}
    >
      <View style={[styles.typeIcon, { backgroundColor: hexWithAlpha(stopColor, 0.12) }]}>
        <CarProfileIcon size={16} color={stopColor} weight="fill" />
      </View>
      <View style={styles.surfaceCardBody}>
        <View style={styles.rentalNameRow}>
          <Text style={styles.surfaceCardName}>
            {booking.company}{booking.carType ? ` · ${booking.carType}` : ''}
          </Text>
          {badgeLabel && (
            <View style={[styles.rentalBadge, { backgroundColor: hexWithAlpha(stopColor, 0.12) }]}>
              <Text style={[styles.rentalBadgeText, { color: stopColor }]}>{badgeLabel}</Text>
            </View>
          )}
        </View>
        <Text style={styles.surfaceCardMeta}>
          {shortDate(booking.pickupDate)} – {shortDate(booking.dropoffDate)}
        </Text>
        <Text style={styles.surfaceCardMeta}>
          {isDropoffStopHere ? booking.dropoffLocation : booking.pickupLocation}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Restaurant card — food-color tinted surface ───────────────────────────────

function RestaurantCard({ booking, onPress }: { booking: Extract<Booking, { type: 'restaurant' }>, onPress?: () => void }) {
  const foodColor = TypeColors.food;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.85 : 1} disabled={!onPress}>
      <View
        style={[
          styles.surfaceCard,
          { borderColor: hexWithAlpha(foodColor, 0.18) },
        ]}
      >
        <View style={[styles.typeIcon, { backgroundColor: hexWithAlpha(foodColor, 0.10) }]}>
          <ForkKnifeIcon size={16} color={foodColor} weight="fill" />
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
    </TouchableOpacity>
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
    borderRadius: Radius.card,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 8,
  },
  flightTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  flightTag: {
    ...Typography.roles.caps,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.8,
  },
  onTimeChip: {
    height: 24,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(62,123,82,0.30)',
    borderWidth: 1,
    borderColor: 'rgba(100,200,140,0.30)',
    justifyContent: 'center',
  },
  onTimeText: {
    ...Typography.roles.caps,
    color: '#a0f0c0',
    letterSpacing: 0.5,
  },
  flightRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  routeEndpoint: { flex: 1, alignItems: 'flex-start' },
  routeEndpointRight: { alignItems: 'flex-end' },
  airportCode: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: Core.white,
    fontFamily: 'DMSans',
  },
  airportCity: {
    fontSize: 11,
    color: hexWithAlpha(Core.white, 0.55),
    fontFamily: 'DMSans',
    fontWeight: '500',
    marginTop: 2,
  },
  flightTime: {
    ...Typography.roles.chip,
    color: 'rgba(255,255,255,0.70)',
    marginTop: 4,
  },
  routeArrow: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 8,
  },
  legList: {
    gap: 4,
    marginBottom: 6,
  },
  legRow: {
    ...Typography.roles.sub,
    color: 'rgba(255,255,255,0.55)',
  },
  flightFooter: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
  flightFooterBlock: { flex: 1 },
  flightFooterLabel: {
    fontSize: 10,
    fontFamily: 'DMSans',
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.40)',
    marginBottom: 2,
  },
  flightFooterValue: {
    fontSize: 14,
    fontFamily: 'DMSans',
    fontWeight: '700',
    color: 'rgba(255,255,255,0.90)',
  },
  // Surface cards (hotel, rental, restaurant)
  surfaceCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    borderRadius: Radius.row,
    borderWidth: 1,
    backgroundColor: Core.surface,
    padding: Spacing.md,
    ...Shadow.row,
  },
  typeIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.tile,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  surfaceCardBody:   { flex: 1 },
  surfaceCardName:   { ...Typography.roles.chip, fontWeight: '700' as const, color: Core.text, marginBottom: 3 },
  surfaceCardMeta:   { ...Typography.roles.sub, color: Core.textMuted, marginBottom: 1 },
  surfaceCardAccent: { ...Typography.roles.chip, marginTop: 3 },
  rentalNameRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rentalBadge:       { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  rentalBadgeText:   { fontSize: 11, fontWeight: '700' as const, fontFamily: 'DMSans' },
});
