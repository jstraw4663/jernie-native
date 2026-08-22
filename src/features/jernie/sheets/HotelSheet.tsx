import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import type { Icon } from 'phosphor-react-native';
import { BarbellIcon } from 'phosphor-react-native/src/icons/Barbell';
import { BellIcon } from 'phosphor-react-native/src/icons/Bell';
import { CalendarCheckIcon } from 'phosphor-react-native/src/icons/CalendarCheck';
import { CalendarDotsIcon } from 'phosphor-react-native/src/icons/CalendarDots';
import { CarProfileIcon } from 'phosphor-react-native/src/icons/CarProfile';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { CoffeeIcon } from 'phosphor-react-native/src/icons/Coffee';
import { KeyIcon } from 'phosphor-react-native/src/icons/Key';
import { PawPrintIcon } from 'phosphor-react-native/src/icons/PawPrint';
import { PersonSimpleSwimIcon } from 'phosphor-react-native/src/icons/PersonSimpleSwim';
import { SheetHero } from './SheetHero';
import { InfoSection, DistanceModule } from './SheetParts';
import { MOCK_HOTEL } from './mockEntityData';
import { Core, Radius, Spacing, Typography } from '@/src/design/tokens';
import { hexWithAlpha } from '@/src/utils/colors';
import type { HotelBooking } from '@/src/types';

interface HotelSheetProps {
  booking: HotelBooking;
  stopColor: string;
  /** When provided, an Edit control opens the booking form for this booking. */
  onEdit?: () => void;
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

const AMENITY_ICONS: Record<string, Icon> = {
  Pool: PersonSimpleSwimIcon, Fitness: BarbellIcon, 'Free Parking': CarProfileIcon,
  'Pet-Friendly': PawPrintIcon, Breakfast: CoffeeIcon, Concierge: BellIcon,
};

export function HotelSheet({ booking, stopColor, onEdit, onClose }: HotelSheetProps) {
  const m = MOCK_HOTEL;
  const n = nights(booking.checkIn, booking.checkOut);
  const scrollY = useSharedValue(0);
  const handleScroll = (e: { nativeEvent: { contentOffset: { y: number } } }) => { scrollY.value = e.nativeEvent.contentOffset.y; };

  return (
    <View style={s.root}>
      <SheetHero mode="travel" photoUri={m.heroPhoto} stopColor={stopColor} onClose={onClose} scrollY={scrollY}>
        <View style={[s.badge, { backgroundColor: Core.onPhotoChip, borderColor: Core.onPhoto2 }]}>
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
          {onEdit && (
            <TouchableOpacity testID="sheet-edit-button" style={s.editButton} onPress={onEdit} activeOpacity={0.7}>
              <Text style={[s.editText, { color: stopColor }]}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Your Stay</Text>
        <View style={[s.timeline, { borderColor: hexWithAlpha(stopColor, 0.18) }]}>
          <TRow Glyph={CalendarDotsIcon} color={stopColor} title={`Check-in: ${shortDate(booking.checkIn)} · 3:00 PM`} sub="Early check-in requested · awaiting confirmation" />
          {booking.roomType && (
            <TRow Glyph={KeyIcon} color={stopColor} title={booking.roomType} sub={booking.confirmationCode ? `Conf: ${booking.confirmationCode}` : 'Booked'} />
          )}
          <TRow Glyph={CalendarCheckIcon} color={stopColor} title={`Check-out: ${shortDate(booking.checkOut)} · 11:00 AM`} sub={`${n} night${n !== 1 ? 's' : ''} total`} last />
        </View>

        <Text style={[s.sectionTitle, { marginTop: Spacing.sm }]}>Amenities</Text>
        <View style={s.amenityRow}>
          {m.amenities.map(a => (
            <View key={a} style={s.amenity}>
              {(() => { const Glyph = AMENITY_ICONS[a] ?? CheckIcon; return <Glyph size={11} color={Core.textMuted} weight="fill" />; })()}
              <Text style={s.amenityTxt}>{a}</Text>
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

function TRow({ Glyph, color, title, sub, last = false }: { Glyph: Icon; color: string; title: string; sub: string; last?: boolean }) {
  return (
    <View style={[s.tRow, !last && s.tRowBorder]}>
      <View style={[s.tIcon, { backgroundColor: hexWithAlpha(color, 0.12) }]}>
        <Glyph size={13} color={color} weight="fill" />
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
  subtitle:    { ...Typography.roles.sub, color: Core.textMuted, lineHeight: 18 },
  ratingCol:   { alignItems: 'flex-end', gap: 3, flexShrink: 0 },
  stars:       { fontSize: 13, color: Core.textMuted, fontWeight: '700' as const, fontFamily: 'DMSans' },
  ratingCount: { fontSize: 11, color: Core.textFaint, fontFamily: 'DMSans' },
  editButton:  { borderWidth: 1, borderColor: Core.border, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 6, marginTop: 4 },
  editText:    { ...Typography.roles.button },
  section:     { paddingHorizontal: Spacing.base, paddingTop: Spacing.md },
  sectionTitle:{ fontSize: 11, fontFamily: 'DMSans', fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase', color: Core.textFaint, marginBottom: Spacing.sm },
  timeline:    { backgroundColor: Core.surface, borderWidth: 1, borderRadius: Radius.row, overflow: 'hidden', marginBottom: Spacing.md },
  tRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, padding: Spacing.sm },
  tRowBorder:  { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Core.border },
  tIcon:       { width: 32, height: 32, borderRadius: Radius.icon, alignItems: 'center', justifyContent: 'center' },
  tTitle:      { fontSize: 13, fontWeight: '600' as const, fontFamily: 'DMSans', color: Core.text },
  tSub:        { fontSize: 11, color: Core.textMuted, fontFamily: 'DMSans', marginTop: 1 },
  amenityRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: Spacing.md },
  amenity:     { height: 28, paddingHorizontal: 10, borderRadius: Radius.full, backgroundColor: Core.surface, borderWidth: 1, borderColor: Core.border, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center' },
  amenityTxt:  { fontSize: 11, fontWeight: '600' as const, fontFamily: 'DMSans', color: Core.textMuted },
  distPad:     { paddingHorizontal: Spacing.base },
  bottomPad:   { height: 32 },
});
