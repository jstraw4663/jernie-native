import type { Icon } from 'phosphor-react-native';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Core, Radius, Scrim, Spacing } from '@/src/design/tokens';
import { stopHeroGradient, hexWithAlpha } from '@/src/utils/colors';

type PlaceMode = {
  mode: 'place';
  photoUri?: string;  // absent → gradient background (most real places have no photo)
  Glyph: Icon;
  categoryLabel: string;
  stopLabel: string;
  stopColor: string;
};

type TravelMode = {
  mode: 'travel';
  photoUri?: string;
  stopColor: string;
  children: React.ReactNode;
};

type SheetHeroProps = (PlaceMode | TravelMode) & {
  onClose: () => void;
  scrollY?: SharedValue<number>;
};

export function SheetHero(props: SheetHeroProps) {
  const _scrollY = useSharedValue(0);
  const scrollY = props.scrollY ?? _scrollY;
  const gradientColors = stopHeroGradient(props.stopColor);

  const heroStyle = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [0, 100], [220, 72], Extrapolation.CLAMP),
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 60], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View style={[s.hero, heroStyle]}>
      {props.photoUri ? (
        <Image
          source={{ uri: props.photoUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={[Scrim.mid, Scrim.bottom]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      <LinearGradient
        colors={[Scrim.top, Scrim.mid, Scrim.bottom]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />

      <TouchableOpacity style={s.closeBtn} onPress={props.onClose} activeOpacity={0.8}>
        <XIcon size={14} color={Core.white} weight="bold" />
      </TouchableOpacity>

      <Animated.View style={[StyleSheet.absoluteFill, contentStyle]} pointerEvents="none">
        {props.mode === 'place' ? (
          <View style={s.heroBottom}>
            <View style={s.heroEmoji}>
              <props.Glyph size={17} color={Core.white} weight="fill" />
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
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  hero:        { overflow: 'hidden', backgroundColor: Core.text },
  closeBtn:    { position: 'absolute', top: 14, right: 14, width: Spacing.xxl, height: Spacing.xxl, borderRadius: Radius.row, backgroundColor: Core.onPhotoChip, borderWidth: 1, borderColor: hexWithAlpha(Core.white, 0.12), alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  closeTxt:    { fontSize: 14, fontWeight: '600' as const, color: Core.white, fontFamily: 'DMSans' },
  heroBottom:  { position: 'absolute', left: Spacing.base, right: Spacing.base, bottom: Spacing.base, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', zIndex: 2 },
  heroEmoji:   { width: 52, height: 52, borderRadius: Radius.card, backgroundColor: hexWithAlpha(Core.white, 0.15), borderWidth: 1, borderColor: hexWithAlpha(Core.white, 0.2), alignItems: 'center', justifyContent: 'center' },
  heroEmojiTxt:{ fontSize: 28 },
  heroChips:   { alignItems: 'flex-end', gap: 5 },
  catChip:     { height: 24, paddingHorizontal: 10, borderRadius: Radius.full, backgroundColor: hexWithAlpha(Core.white, 0.14), borderWidth: 1, borderColor: hexWithAlpha(Core.white, 0.22), alignItems: 'center', justifyContent: 'center' },
  catChipTxt:  { fontSize: 11, fontWeight: '700' as const, color: hexWithAlpha(Core.white, 0.9), fontFamily: 'DMSans' },
  stopChip:    { height: 22, paddingHorizontal: 9, borderRadius: Radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stopChipTxt: { fontSize: 10, fontWeight: '700' as const, color: Core.white, fontFamily: 'DMSans' },
  heroTravel:  { position: 'absolute', left: Spacing.base, right: Spacing.base, bottom: Spacing.base, zIndex: 2 },
});
