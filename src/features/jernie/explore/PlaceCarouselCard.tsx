import { iconFor } from '@/src/design/icons';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Core, Radius, Scrim, Shadow, Spacing, Typography } from '@/src/design/tokens';
import { stopHeroGradient } from '@/src/utils/colors';
import type { Place } from '@/src/types';

interface PlaceCarouselCardProps {
  place: Place;
  photoUrl: string | undefined;
  stopColor: string;
  isAdded: boolean;
  onPress: () => void;
}

export function PlaceCarouselCard({ place, photoUrl, stopColor, isAdded, onPress }: PlaceCarouselCardProps) {
  const gradientColors = stopHeroGradient(stopColor);

  return (
    <TouchableOpacity style={[s.card, Shadow.row]} onPress={onPress} activeOpacity={0.85}>
      <View style={s.photoWrap}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <LinearGradient colors={[Scrim.mid, Scrim.bottom]} style={StyleSheet.absoluteFill} />
        )}
        <View style={s.emojiBadge}>
          {(() => { const Glyph = iconFor(place.category); return <Glyph size={12} color={Core.white} weight="fill" />; })()}
        </View>
        {isAdded && (
          <View style={s.addedBadge}>
            <CheckIcon size={9} color={s.addedBadgeText.color} weight="bold" />
            <Text style={s.addedBadgeText}>Added</Text>
          </View>
        )}
      </View>
      <Text style={s.name} numberOfLines={1}>{place.name}</Text>
      <View style={s.metaRow}>
        {place.rating != null && <Text style={s.meta}>★ {place.rating}</Text>}
        {!!place.price && <Text style={s.meta}>{place.price}</Text>}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card:       { width: 148 },
  photoWrap:  { width: 148, height: 108, borderRadius: Radius.tile, backgroundColor: Core.surfaceMuted, overflow: 'hidden', marginBottom: Spacing.xs },
  emojiBadge: { position: 'absolute', top: 6, left: 6, width: 26, height: 26, borderRadius: Radius.icon, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },
  emojiText:  { fontSize: 14 },
  addedBadge: { position: 'absolute', bottom: 6, right: 6, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(0,0,0,0.55)' },
  addedBadgeText: { fontSize: 10, fontWeight: '700' as const, color: Core.white, fontFamily: 'DMSans' },
  name:       { ...Typography.roles.chip, color: Core.text },
  metaRow:    { flexDirection: 'row', gap: Spacing.sm, marginTop: 2 },
  meta:       { ...Typography.roles.sub, color: Core.textMuted },
});
