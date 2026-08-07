import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SheetHero } from './SheetHero';
import { InfoSection } from './SheetParts';
import { Brand, Core, Typography, Spacing, Radius } from '@/src/design/tokens';
import { hexWithAlpha } from '@/src/utils/colors';
import type { RentalBooking } from '@/src/types';

interface RentalSheetProps {
  booking: RentalBooking;
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
 * Detail view for a rental-car booking. Real schema fields only — no mock enrichment — with
 * pickup and dropoff split into their own sections since they routinely differ in place and
 * time. Absent optional fields drop their row rather than rendering an empty value.
 */
export function RentalSheet({ booking, stopColor, stopLabel, onEdit, onClose }: RentalSheetProps) {
  const scrollY = useSharedValue(0);
  const handleScroll = (e: { nativeEvent: { contentOffset: { y: number } } }) => { scrollY.value = e.nativeEvent.contentOffset.y; };

  const pickupRows = [
    { label: 'Date', value: shortDate(booking.pickupDate) },
    ...(booking.pickupTime ? [{ label: 'Time', value: booking.pickupTime }] : []),
    { label: 'Location', value: booking.pickupLocation },
  ];

  const dropoffRows = [
    { label: 'Date', value: shortDate(booking.dropoffDate) },
    ...(booking.dropoffTime ? [{ label: 'Time', value: booking.dropoffTime }] : []),
    { label: 'Location', value: booking.dropoffLocation },
  ];

  const detailRows = [
    ...(booking.carType ? [{ label: 'Car type', value: booking.carType }] : []),
    ...(booking.confirmationCode ? [{ label: 'Confirmation code', value: booking.confirmationCode, variant: 'link' as const }] : []),
  ];

  return (
    <View style={s.root}>
      <SheetHero mode="travel" stopColor={stopColor} onClose={onClose} scrollY={scrollY}>
        <View style={[s.badge, { backgroundColor: hexWithAlpha(Brand.navySoft, 0.32), borderColor: hexWithAlpha(Brand.navySoft, 0.4) }]}>
          <Text style={[s.badgeTxt, { color: hexWithAlpha(Core.white, 0.80) }]}>Rental car</Text>
        </View>
        <Text style={s.heroTitle}>{shortDate(booking.pickupDate)} → {shortDate(booking.dropoffDate)}</Text>
        <Text style={s.heroMeta}>{booking.carType ?? booking.company}</Text>
      </SheetHero>

      <BottomSheetScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} onScroll={handleScroll}>
        <View style={s.titleRow}>
          <View style={s.titleLeft}>
            <Text style={s.name}>{booking.company}</Text>
            <Text style={s.subtitle}>{stopLabel}</Text>
          </View>
          {onEdit && (
            <TouchableOpacity testID="sheet-edit-button" style={s.editButton} onPress={onEdit} activeOpacity={0.7}>
              <Text style={[s.editText, { color: stopColor }]}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        <InfoSection title="Pickup" rows={pickupRows} />
        <InfoSection title="Dropoff" rows={dropoffRows} />
        {detailRows.length > 0 && <InfoSection title="Details" rows={detailRows} />}
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
