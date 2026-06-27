import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Core, Brand, Spacing, Radius } from '@/src/design/tokens';
import { stopHeroGradient, hexWithAlpha } from '@/src/utils/colors';

type PlaceMode = {
  mode: 'place';
  photoUri: string;
  emoji: string;
  categoryLabel: string;
  stopLabel: string;
  stopColor: string;
};

type TravelMode = {
  mode: 'travel';
  photoUri?: string;  // absent → gradient background
  stopColor: string;
  children: React.ReactNode;
};

type SheetHeroProps = (PlaceMode | TravelMode) & { onClose: () => void };

export function SheetHero(props: SheetHeroProps) {
  const gradientColors = stopHeroGradient(props.stopColor);

  return (
    <View style={s.hero}>
      {(props.mode === 'place' || props.photoUri) ? (
        <Image
          source={{ uri: props.mode === 'place' ? props.photoUri : (props as TravelMode).photoUri! }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={[Brand.navy, gradientColors[1]]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      <LinearGradient
        colors={['rgba(7,13,24,0.12)', 'rgba(7,13,24,0.40)', 'rgba(7,13,24,0.84)']}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />

      <TouchableOpacity style={s.closeBtn} onPress={props.onClose} activeOpacity={0.8}>
        <Text style={s.closeTxt}>✕</Text>
      </TouchableOpacity>

      {props.mode === 'place' ? (
        <View style={s.heroBottom}>
          <View style={s.heroEmoji}>
            <Text style={s.heroEmojiTxt}>{props.emoji}</Text>
          </View>
          <View style={s.heroChips}>
            <View style={s.catChip}>
              <Text style={s.catChipTxt}>{props.categoryLabel}</Text>
            </View>
            <View style={[s.stopChip, { backgroundColor: hexWithAlpha(props.stopColor, 0.30), borderColor: hexWithAlpha(props.stopColor, 0.55) }]}>
              <Text style={s.stopChipTxt}>{props.stopLabel}</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={s.heroTravel}>{props.children}</View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  hero:        { height: 220, overflow: 'hidden', backgroundColor: Brand.navy },
  closeBtn:    { position: 'absolute', top: 14, right: 14, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.32)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  closeTxt:    { fontSize: 14, fontWeight: '600' as const, color: Core.white, fontFamily: 'DMSans' },
  heroBottom:  { position: 'absolute', left: Spacing.base, right: Spacing.base, bottom: Spacing.base, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', zIndex: 2 },
  heroEmoji:   { width: 52, height: 52, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroEmojiTxt:{ fontSize: 28 },
  heroChips:   { alignItems: 'flex-end', gap: 5 },
  catChip:     { height: 24, paddingHorizontal: 10, borderRadius: Radius.full, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  catChipTxt:  { fontSize: 11, fontWeight: '700' as const, color: 'rgba(255,255,255,0.9)', fontFamily: 'DMSans' },
  stopChip:    { height: 22, paddingHorizontal: 9, borderRadius: Radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stopChipTxt: { fontSize: 10, fontWeight: '700' as const, color: Core.white, fontFamily: 'DMSans' },
  heroTravel:  { position: 'absolute', left: Spacing.base, right: Spacing.base, bottom: Spacing.base, zIndex: 2 },
});
