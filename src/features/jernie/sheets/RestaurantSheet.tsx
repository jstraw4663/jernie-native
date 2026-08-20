import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SheetHero } from './SheetHero';
import { InfoSection } from './SheetParts';
import { Brand, Core, Typography, Spacing, Radius } from '@/src/design/tokens';
import { hexWithAlpha } from '@/src/utils/colors';
import type { RestaurantBooking } from '@/src/types';

interface RestaurantSheetProps {
  booking: RestaurantBooking;
  stopColor: string;
  stopLabel: string;
  onEdit?: () => void;
  onClose: () => void;
}

function shortDate(iso: string) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date(iso + 'T12:00:00');
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

/**
 * Detail view for a restaurant booking. Unlike `HotelSheet`/`PlaceSheet`, this renders **only
 * real schema fields** — no mock enrichment — so every row on screen corresponds to something
 * the user actually entered. Optional fields that are absent drop their row entirely rather
 * than rendering an empty value.
 */
export function RestaurantSheet({ booking, stopColor, stopLabel, onEdit, onClose }: RestaurantSheetProps) {
  const scrollY = useSharedValue(0);
  const handleScroll = (e: { nativeEvent: { contentOffset: { y: number } } }) => { scrollY.value = e.nativeEvent.contentOffset.y; };

  const rows = [
    { label: 'Date', value: shortDate(booking.date) },
    ...(booking.time ? [{ label: 'Time', value: booking.time }] : []),
    ...(booking.partySize !== undefined ? [{ label: 'Party size', value: `${booking.partySize}` }] : []),
    ...(booking.confirmationCode ? [{ label: 'Confirmation code', value: booking.confirmationCode, variant: 'link' as const }] : []),
  ];

  return (
    <View style={s.root}>
      <SheetHero mode="travel" stopColor={stopColor} onClose={onClose} scrollY={scrollY}>
        <View style={[s.badge, { backgroundColor: hexWithAlpha(Brand.navySoft, 0.32), borderColor: hexWithAlpha(Brand.navySoft, 0.4) }]}>
          <Text style={[s.badgeTxt, { color: hexWithAlpha(Core.white, 0.80) }]}>Reservation</Text>
        </View>
        <Text style={s.heroTitle}>{shortDate(booking.date)}</Text>
        <Text style={s.heroMeta}>
          {booking.time ?? 'No time set'}
          {booking.partySize !== undefined ? ` · Party of ${booking.partySize}` : ''}
        </Text>
      </SheetHero>

      <BottomSheetScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} onScroll={handleScroll}>
        <View style={s.titleRow}>
          <View style={s.titleLeft}>
            <Text style={s.name}>{booking.restaurantName}</Text>
            <Text style={s.subtitle}>{stopLabel}</Text>
          </View>
          {onEdit && (
            <TouchableOpacity testID="sheet-edit-button" style={s.editButton} onPress={onEdit} activeOpacity={0.7}>
              <Text style={[s.editText, { color: stopColor }]}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        <InfoSection title="Reservation" rows={rows} />
        <View style={s.bottomPad} />
      </BottomSheetScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1 },
  scroll:        { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  badge:         { alignSelf: 'flex-start', borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, marginBottom: 8 },
  badgeTxt:      { fontSize: 11, fontWeight: '700' as const, fontFamily: 'DMSans' },
  heroTitle:     { fontSize: 26, fontWeight: '800' as const, color: Core.white, fontFamily: 'DMSans', letterSpacing: -0.5, marginBottom: 3 },
  heroMeta:      { fontSize: 13, color: hexWithAlpha(Core.white, 0.65), fontFamily: 'DMSans' },
  titleRow:      { padding: Spacing.base, paddingBottom: Spacing.sm, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  titleLeft:     { flex: 1 },
  name:          { fontFamily: 'Fraunces', fontSize: 26, color: Core.text, marginBottom: 3, lineHeight: 30 },
  subtitle:      { ...Typography.roles.meta, color: Core.textMuted, lineHeight: 18 },
  editButton:    { borderWidth: 1, borderColor: Core.border, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 6, flexShrink: 0 },
  editText:      { ...Typography.roles.button },
  bottomPad:     { height: 32 },
});
