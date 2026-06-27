import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import { SheetHero } from './SheetHero';
import { InfoSection, DistanceModule } from './SheetParts';
import { MOCK_FLIGHT } from './mockEntityData';
import { Core, Brand, Semantic, Spacing, Radius, Typography } from '@/src/design/tokens';
import { hexWithAlpha } from '@/src/utils/colors';
import type { FlightBooking } from '@/src/types';

interface FlightSheetProps {
  booking: FlightBooking;
  stopColor: string;
  onClose: () => void;
}

const STATUS_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  'on-time':  { bg: hexWithAlpha(Semantic.success, 0.32), border: hexWithAlpha(Semantic.success, 0.35), text: hexWithAlpha(Core.white, 0.88) },
  'delayed':  { bg: hexWithAlpha(Semantic.warning, 0.32), border: hexWithAlpha(Semantic.warning, 0.40), text: hexWithAlpha(Core.white, 0.88) },
  'cancelled':{ bg: hexWithAlpha(Semantic.error,   0.32), border: hexWithAlpha(Semantic.error,   0.35), text: hexWithAlpha(Core.white, 0.88) },
  'default':  { bg: hexWithAlpha(Core.textMuted,   0.32), border: hexWithAlpha(Core.textMuted,   0.35), text: hexWithAlpha(Core.white, 0.80) },
};

const STATUS: Record<string, { label: string; bg: string; border: string; color: string }> = {
  on_time:   { label: '● On Time',   bg: STATUS_STYLES['on-time'].bg,   border: STATUS_STYLES['on-time'].border,   color: STATUS_STYLES['on-time'].text },
  delayed:   { label: '⚠ Delayed',   bg: STATUS_STYLES['delayed'].bg,   border: STATUS_STYLES['delayed'].border,   color: STATUS_STYLES['delayed'].text },
  cancelled: { label: '✕ Cancelled', bg: STATUS_STYLES['cancelled'].bg, border: STATUS_STYLES['cancelled'].border, color: STATUS_STYLES['cancelled'].text },
  landed:    { label: '✓ Landed',    bg: STATUS_STYLES['on-time'].bg,   border: STATUS_STYLES['on-time'].border,   color: STATUS_STYLES['on-time'].text },
  unknown:   { label: '? Unknown',   bg: STATUS_STYLES['default'].bg,   border: STATUS_STYLES['default'].border,   color: STATUS_STYLES['default'].text },
};

export function FlightSheet({ booking, stopColor, onClose }: FlightSheetProps) {
  const m = MOCK_FLIGHT;
  const st = STATUS[m.status] ?? STATUS.unknown;
  const scrollY = useSharedValue(0);
  const handleScroll = (e: { nativeEvent: { contentOffset: { y: number } } }) => { scrollY.value = e.nativeEvent.contentOffset.y; };

  return (
    <View style={s.root}>
      <SheetHero mode="travel" stopColor={Brand.navy} onClose={onClose} scrollY={scrollY}>
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
      <BottomSheetScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={16}>
      <View style={s.titleBlock}>
        <Text style={s.name}>{booking.origin} → {booking.destination} · {booking.flightNumber}</Text>
        <Text style={s.subtitle}>{booking.airline} · {booking.departureDate}</Text>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Flight Status</Text>
        <LinearGradient colors={[Brand.navy, Brand.navySoft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.flightBlock}>
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
    </View>
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
  root:         { flex: 1 },
  scroll:       { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  badge:        { alignSelf: 'flex-start', borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, marginBottom: 8 },
  badgeTxt:     { fontSize: 11, fontWeight: '700' as const, fontFamily: 'DMSans' },
  heroRoute:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroAirport:  { fontSize: 28, fontWeight: '800' as const, color: Core.white, fontFamily: 'DMSans', letterSpacing: -0.5 },
  heroArrow:    { fontSize: 18, color: hexWithAlpha(Core.white, 0.45), paddingHorizontal: 4 },
  heroMeta:     { fontSize: 12, color: hexWithAlpha(Core.white, 0.65), fontFamily: 'DMSans', marginTop: 3 },
  titleBlock:   { padding: Spacing.base, paddingBottom: Spacing.sm },
  name:         { fontFamily: 'Fraunces', fontSize: 22, color: Core.text, marginBottom: 3, lineHeight: 26 },
  subtitle:     { ...Typography.roles.meta, color: Core.textMuted, lineHeight: 18 },
  section:      { paddingHorizontal: Spacing.base, paddingTop: Spacing.md },
  sectionTitle: { fontSize: 11, fontFamily: 'DMSans', fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase', color: Core.textFaint, marginBottom: Spacing.sm },
  flightBlock:  { borderRadius: Radius.card, padding: Spacing.md, marginBottom: Spacing.sm },
  flRoute:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  flEnd:        { flex: 1 },
  flEndRight:   { alignItems: 'flex-end' },
  flAirport:    { fontSize: 28, fontWeight: '800' as const, color: Core.white, fontFamily: 'DMSans', letterSpacing: -0.5 },
  flTime:       { fontSize: 14, fontWeight: '700' as const, color: hexWithAlpha(Core.white, 0.75), fontFamily: 'DMSans', marginTop: 4 },
  flArrow:      { color: hexWithAlpha(Core.white, 0.40), fontSize: 20, paddingHorizontal: 4 },
  flMeta:       { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: hexWithAlpha(Core.white, 0.10) },
  flMetaLabel:  { fontSize: 10, fontWeight: '600' as const, fontFamily: 'DMSans', color: hexWithAlpha(Core.white, 0.40), letterSpacing: 0.8, textTransform: 'uppercase' as const, marginBottom: 2 },
  flMetaValue:  { fontSize: 15, fontWeight: '700' as const, fontFamily: 'DMSans', color: Core.white },
  distPad:      { paddingHorizontal: Spacing.base },
  bottomPad:    { height: 32 },
});
