import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import { SheetHero } from './SheetHero';
import { InfoSection, DistanceModule } from './SheetParts';
import { MOCK_FLIGHT } from './mockEntityData';
import { Core, Brand, Spacing, Radius, Typography } from '@/src/design/tokens';
import type { FlightBooking } from '@/src/types';

interface FlightSheetProps {
  booking: FlightBooking;
  stopColor: string;
  onClose: () => void;
}

const STATUS: Record<string, { label: string; bg: string; border: string; color: string }> = {
  on_time:   { label: '● On Time',   bg: 'rgba(62,123,82,0.32)',  border: 'rgba(100,200,140,0.35)', color: '#b0f0c8' },
  delayed:   { label: '⚠ Delayed',   bg: 'rgba(181,107,0,0.32)',  border: 'rgba(220,160,50,0.4)',   color: '#fdd' },
  cancelled: { label: '✕ Cancelled', bg: 'rgba(163,72,95,0.32)',  border: 'rgba(200,100,120,0.35)', color: '#fcc' },
  landed:    { label: '✓ Landed',    bg: 'rgba(62,123,82,0.32)',  border: 'rgba(100,200,140,0.35)', color: '#b0f0c8' },
  unknown:   { label: '? Unknown',   bg: 'rgba(80,80,80,0.32)',   border: 'rgba(150,150,150,0.35)', color: '#ddd' },
};

export function FlightSheet({ booking, stopColor, onClose }: FlightSheetProps) {
  const m = MOCK_FLIGHT;
  const st = STATUS[m.status] ?? STATUS.unknown;

  return (
    <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
      <SheetHero mode="travel" stopColor={Brand.navy} onClose={onClose}>
        <View style={[s.badge, { backgroundColor: st.bg, borderColor: st.border }]}>
          <Text style={[s.badgeTxt, { color: st.color }]}>{st.label}</Text>
        </View>
        <View style={s.heroRoute}>
          <View>
            <Text style={s.heroAirport}>{booking.origin}</Text>
            <Text style={s.heroMeta}>{booking.departureTime}{m.terminal_origin ? ` · Terminal ${m.terminal_origin}` : ''}</Text>
          </View>
          <Text style={s.heroArrow}>→</Text>
          <View>
            <Text style={s.heroAirport}>{booking.destination}</Text>
            <Text style={s.heroMeta}>{booking.arrivalTime}</Text>
          </View>
        </View>
      </SheetHero>

      <View style={s.titleBlock}>
        <Text style={s.name}>{booking.origin} → {booking.destination} · {booking.flightNumber}</Text>
        <Text style={s.subtitle}>{booking.airline} · {booking.departureDate}</Text>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Flight Status</Text>
        <LinearGradient colors={[Brand.navy, '#1a3d5c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.flightBlock}>
          <View style={s.flRoute}>
            <View style={s.flEnd}>
              <Text style={s.flAirport}>{booking.origin}</Text>
              <Text style={s.flTime}>{booking.departureTime}</Text>
            </View>
            <Text style={s.flArrow}>→</Text>
            <View style={[s.flEnd, s.flEndRight]}>
              <Text style={s.flAirport}>{booking.destination}</Text>
              <Text style={s.flTime}>{booking.arrivalTime}</Text>
            </View>
          </View>
          <View style={s.flMeta}>
            {m.gate_origin    && <MetaItem label="Gate"     value={m.gate_origin} />}
            {m.aircraft_type  && <MetaItem label="Aircraft" value={m.aircraft_type} />}
            <MetaItem label="Flight" value={booking.flightNumber} />
          </View>
        </LinearGradient>
      </View>

      <InfoSection title="Status" rows={[
        { label: 'Status',      value: m.status === 'on_time' ? 'On Time' : m.status, variant: m.status === 'on_time' ? 'link' : 'warning' },
        { label: 'Departs',     value: `${booking.departureTime}${m.gate_origin ? ` · Gate ${m.gate_origin}` : ''}${m.terminal_origin ? ` · Terminal ${m.terminal_origin}` : ''}` },
        { label: 'Arrives',     value: `${booking.arrivalTime}${m.terminal_destination ? ` · Terminal ${m.terminal_destination}` : ''}` },
        { label: 'Leave hotel', value: m.leaveByLabel, variant: 'warning' },
      ]} />

      <InfoSection title="After Landing" rows={[
        { label: 'Rental car',  value: m.afterLanding.rentalLabel },
        { label: 'Drive to BH', value: m.afterLanding.driveLabel },
      ]} />
      <View style={s.distPad}>
        <DistanceModule label={m.afterLanding.distanceLabel} value={m.afterLanding.distanceValue} stopColor={stopColor} />
      </View>
      <View style={s.bottomPad} />
    </BottomSheetScrollView>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={s.flMetaLabel}>{label}</Text>
      <Text style={s.flMetaValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  scroll:       { flexGrow: 1 },
  badge:        { alignSelf: 'flex-start', borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, marginBottom: 8 },
  badgeTxt:     { fontSize: 11, fontWeight: '700' as const, fontFamily: 'DMSans' },
  heroRoute:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroAirport:  { fontSize: 28, fontWeight: '800' as const, color: Core.white, fontFamily: 'DMSans', letterSpacing: -0.5 },
  heroArrow:    { fontSize: 18, color: 'rgba(255,255,255,0.45)', paddingHorizontal: 4 },
  heroMeta:     { fontSize: 12, color: 'rgba(255,255,255,0.65)', fontFamily: 'DMSans', marginTop: 3 },
  titleBlock:   { padding: Spacing.base, paddingBottom: Spacing.sm },
  name:         { fontFamily: 'Fraunces', fontSize: 22, color: Core.text, marginBottom: 3, lineHeight: 26 },
  subtitle:     { ...Typography.roles.meta, color: Core.textMuted, lineHeight: 18 },
  section:      { paddingHorizontal: Spacing.base, paddingTop: Spacing.md },
  sectionTitle: { fontSize: 11, fontFamily: 'DMSans', fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase', color: Core.textFaint, marginBottom: Spacing.sm },
  flightBlock:  { borderRadius: Radius.card, padding: Spacing.md, marginBottom: Spacing.sm },
  flRoute:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  flEnd:        { flex: 1 },
  flEndRight:   { alignItems: 'flex-end' },
  flAirport:    { fontSize: 28, fontWeight: '800' as const, color: Core.white, fontFamily: 'DMSans', letterSpacing: -0.5 },
  flTime:       { fontSize: 14, fontWeight: '700' as const, color: 'rgba(255,255,255,0.75)', fontFamily: 'DMSans', marginTop: 4 },
  flArrow:      { color: 'rgba(255,255,255,0.4)', fontSize: 20, paddingHorizontal: 4 },
  flMeta:       { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  flMetaLabel:  { fontSize: 10, fontWeight: '600' as const, fontFamily: 'DMSans', color: 'rgba(255,255,255,0.4)', letterSpacing: 0.8, textTransform: 'uppercase' as const, marginBottom: 2 },
  flMetaValue:  { fontSize: 15, fontWeight: '700' as const, fontFamily: 'DMSans', color: Core.white },
  distPad:      { paddingHorizontal: Spacing.base },
  bottomPad:    { height: 32 },
});
