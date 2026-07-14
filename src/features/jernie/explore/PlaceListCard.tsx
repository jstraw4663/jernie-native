import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Core, Spacing, Radius, Typography } from '@/src/design/tokens';
import { hexWithAlpha } from '@/src/utils/colors';
import type { Place } from '@/src/types';

interface PlaceListCardProps {
  place: Place;
  stopColor: string;
  isAdded: boolean;
  onPress: () => void;
}

export function PlaceListCard({ place, stopColor, isAdded, onPress }: PlaceListCardProps) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.85}>
      <View style={[s.iconWrap, { backgroundColor: hexWithAlpha(stopColor, 0.12) }]}>
        <Text style={s.iconText}>{place.emoji ?? '📍'}</Text>
      </View>
      <View style={s.body}>
        <Text style={s.name} numberOfLines={1}>{place.name}</Text>
        <Text style={s.meta} numberOfLines={1}>
          {place.subcategory ? `${place.subcategory} · ` : ''}
          {place.rating != null ? `★ ${place.rating}` : ''}
          {place.price ? ` · ${place.price}` : ''}
        </Text>
      </View>
      {isAdded && (
        <View style={s.addedBadge}>
          <Text style={s.addedBadgeText}>✓ Added</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Core.surface, borderWidth: 1, borderColor: Core.border, borderRadius: Radius.list, padding: Spacing.sm, marginBottom: Spacing.sm },
  iconWrap:{ width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  iconText:{ fontSize: 18 },
  body:    { flex: 1 },
  name:    { ...Typography.roles.label, color: Core.text },
  meta:    { ...Typography.roles.meta, color: Core.textMuted, marginTop: 1, textTransform: 'capitalize' as const },
  addedBadge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: Core.surfaceMuted },
  addedBadgeText: { fontSize: 10, fontWeight: '700' as const, color: Core.textMuted, fontFamily: 'DMSans' },
});
