import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SheetHero } from './SheetHero';
import { InfoSection, DistanceModule } from './SheetParts';
import { MOCK_HOTEL } from './mockEntityData';
import { Brand, Core, Typography, Spacing, Radius } from '@/src/design/tokens';
import { hexWithAlpha } from '@/src/utils/colors';
import type { HotelBooking } from '@/src/types';

interface HotelSheetProps {
  booking: HotelBooking;
  stopColor: string;
  onClose: () => void;
}

function shortDate(iso: string) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date(iso + 'T12:00:00');
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function nights(a: string, b: string) {
  return Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86_400_000);
}

const AMENITY_EMOJI: Record<string, string> = {
  Pool: '🏊', Fitness: '💪', 'Free Parking': '🅿️', 'Pet-Friendly': '🐾', Breakfast: '☕', Concierge: '🛎',
};

export function HotelSheet({ booking, stopColor, onClose }: HotelSheetProps) {
  const m = MOCK_HOTEL;
  const n = nights(booking.checkIn, booking.checkOut);
  const scrollY = useSharedValue(0);
  const handleScroll = (e: { nativeEvent: { contentOffset: { y: number } } }) => { scrollY.value = e.nativeEvent.contentOffset.y; };

  return (
    <View style={s.root}>
      <SheetHero mode="travel" photoUri={m.heroPhoto} stopColor={stopColor} onClose={onClose} scrollY={scrollY}>
        <View style={[s.badge, { backgroundColor: hexWithAlpha(Brand.navySoft, 0.32), borderColor: hexWithAlpha(Brand.navySoft, 0.4) }]}>
          <Text style={[s.badgeTxt, { color: hexWithAlpha(Core.white, 0.80) }]}>Active Stay</Text>
        </View>
        <Text style={s.heroDates}>{shortDate(booking.checkIn)} → {shortDate(booking.checkOut)}</Text>
        <Text style={s.heroMeta}>{n} night{n !== 1 ? 's' : ''}{booking.roomType ? ` · ${booking.roomType}` : ''}</Text>
      </SheetHero>
      <BottomSheetScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={16}>
      <View style={s.titleRow}>
        <View style={s.titleLeft}>
          <Text style={s.name}>{booking.hotelName}</Text>
          <Text style={s.subtitle}>Check-in {shortDate(booking.checkIn)} → {shortDate(booking.checkOut)}</Text>
        </View>
        <View style={s.ratingCol}>
          <Text style={s.stars}>★ {m.rating}</Text>
          <Text style={s.ratingCount}>({m.ratingCount.toLocaleString()})</Text>
        </View>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Your Stay</Text>
        <View style={[s.timeline, { borderColor: hexWithAlpha(stopColor, 0.18) }]}>
          <TRow icon="📅" color={stopColor} title={`Check-in: ${shortDate(booking.checkIn)} · 3:00 PM`} sub="Early check-in requested · awaiting confirmation" />
          {booking.roomType && (
            <TRow icon="🏷️" color={stopColor} title={booking.roomType} sub={booking.confirmationCode ? `Conf: ${booking.confirmationCode}` : 'Booked'} />
          )}
          <TRow icon="📅" color={stopColor} title={`Check-out: ${shortDate(booking.checkOut)} · 11:00 AM`} sub={`${n} night${n !== 1 ? 's' : ''} total`} last />
        </View>

        <Text style={[s.sectionTitle, { marginTop: Spacing.sm }]}>Amenities</Text>
        <View style={s.amenityRow}>
          {m.amenities.map(a => (
            <View key={a} style={s.amenity}>
              <Text style={s.amenityTxt}>{AMENITY_EMOJI[a] ?? '•'} {a}</Text>
            </View>
          ))}
        </View>
      </View>

      <InfoSection title="Contact & Location" rows={[
        { label: 'Phone',   value: m.phone,   variant: 'link' },
        { label: 'Address', value: m.address, variant: 'link' },
        { label: 'Website', value: 'Manage booking', variant: 'link' },
      ]} />
      <View style={s.distPad}>
        <DistanceModule label={m.distanceLabel} value={m.distanceValue} stopColor={stopColor} />
      </View>
      <View style={s.bottomPad} />
      </BottomSheetScrollView>
    </View>
  );
}

function TRow({ icon, color, title, sub, last = false }: { icon: string; color: string; title: string; sub: string; last?: boolean }) {
  return (
    <View style={[s.tRow, !last && s.tRowBorder]}>
      <View style={[s.tIcon, { backgroundColor: hexWithAlpha(color, 0.12) }]}>
        <Text style={s.tIconTxt}>{icon}</Text>
      </View>
      <View>
        <Text style={s.tTitle}>{title}</Text>
        <Text style={s.tSub}>{sub}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1 },
  scroll:      { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  badge:       { alignSelf: 'flex-start', borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, marginBottom: 8 },
  badgeTxt:    { fontSize: 11, fontWeight: '700' as const, fontFamily: 'DMSans' },
  heroDates:   { fontSize: 26, fontWeight: '800' as const, color: Core.white, fontFamily: 'DMSans', letterSpacing: -0.5, marginBottom: 3 },
  heroMeta:    { fontSize: 13, color: hexWithAlpha(Core.white, 0.65), fontFamily: 'DMSans' },
  titleRow:    { padding: Spacing.base, paddingBottom: Spacing.sm, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  titleLeft:   { flex: 1 },
  name:        { fontFamily: 'Fraunces', fontSize: 26, color: Core.text, marginBottom: 3, lineHeight: 30 },
  subtitle:    { ...Typography.roles.meta, color: Core.textMuted, lineHeight: 18 },
  ratingCol:   { alignItems: 'flex-end', gap: 3, flexShrink: 0 },
  stars:       { fontSize: 13, color: Brand.gold, fontWeight: '700' as const, fontFamily: 'DMSans' },
  ratingCount: { fontSize: 11, color: Core.textFaint, fontFamily: 'DMSans' },
  section:     { paddingHorizontal: Spacing.base, paddingTop: Spacing.md },
  sectionTitle:{ fontSize: 11, fontFamily: 'DMSans', fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase', color: Core.textFaint, marginBottom: Spacing.sm },
  timeline:    { backgroundColor: Core.surface, borderWidth: 1, borderRadius: Radius.xl, overflow: 'hidden', marginBottom: Spacing.md },
  tRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, padding: Spacing.sm },
  tRowBorder:  { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Core.border },
  tIcon:       { width: 32, height: 32, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  tIconTxt:    { fontSize: 16 },
  tTitle:      { fontSize: 13, fontWeight: '600' as const, fontFamily: 'DMSans', color: Core.text },
  tSub:        { fontSize: 11, color: Core.textMuted, fontFamily: 'DMSans', marginTop: 1 },
  amenityRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: Spacing.md },
  amenity:     { height: 28, paddingHorizontal: 10, borderRadius: Radius.full, backgroundColor: Core.surface, borderWidth: 1, borderColor: Core.border, alignItems: 'center', justifyContent: 'center' },
  amenityTxt:  { fontSize: 11, fontWeight: '600' as const, fontFamily: 'DMSans', color: Core.textMuted },
  distPad:     { paddingHorizontal: Spacing.base },
  bottomPad:   { height: 32 },
});
