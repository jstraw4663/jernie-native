// The home hero and the pinned stop bar — one layer, two states, one scroll value.
//
// Sits ABOVE the scroll view so content passes underneath it rather than over it. The photo
// re-crops in place: the container's height animates and `contentFit="cover"` re-crops to
// fill, so the image is never smaller than its box and no band can appear above it.
// Reference: docs/design/Jernie Screen.dc.html (the home hero) + reference/collapse.md
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { Animation, Core, Gutter, Scrim, Spacing, Typography } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { ImagePlaceholder, Photo } from '@/src/ui';
import { HERO_MAX, PINNED_BAR_H, RANGE, heroMin } from './collapse';

export interface HomeHeaderProps {
  /** Uppercase, e.g. "DAY 4 OF 8". */
  kicker: string;
  title: string;
  sub: string;
  photo?: string;
  /** The stop the rail is parked on — what the pinned bar names. */
  stopName: string;
  stopDates: string;
  stopPhoto?: string;
  stopCount: number;
  stopIndex: number;
  insetTop: number;
  scrollY: SharedValue<number>;
  onStopPress: (index: number) => void;
}

export function HomeHeader({
  kicker, title, sub, photo, stopName, stopDates, stopPhoto,
  stopCount, stopIndex, insetTop, scrollY, onStopPress,
}: HomeHeaderProps) {
  const [s, t] = useStyles();
  const min = heroMin(insetTop);

  const hero = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [0, RANGE], [HERO_MAX, min], Extrapolation.CLAMP),
  }));

  // The identity fades faster than the scroll — gone by y=64, well before the pinned bar
  // arrives, so the two never overlap. Multipliers are the canvas's.
  const titleFade = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, RANGE / 2.2], [1, 0], Extrapolation.CLAMP),
  }));
  const kickerFade = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, RANGE / 1.6], [1, 0], Extrapolation.CLAMP),
  }));
  // Starts only at the halfway point, so nothing crossfades against the title.
  const pinnedFade = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [RANGE * 0.5, RANGE * 0.9167], [0, 1], Extrapolation.CLAMP),
    // Invisible AND untouchable. Without this the bar's dots keep swallowing taps over the
    // bottom 62px of the photo the whole time it is faded out.
    pointerEvents: scrollY.value > RANGE * 0.5 ? 'auto' : 'none',
  }));

  return (
    <Animated.View style={[s.hero, hero]} pointerEvents="box-none">
      {photo
        ? <Photo source={photo} style={StyleSheet.absoluteFill} transition={Animation.duration.slow} />
        : <ImagePlaceholder style={StyleSheet.absoluteFill} glyphSize={34} />}

      {/* Three stops, not two. The mid stop is what stops the gradient banding across a
          bright sky — see reference/photo-scrim.md. */}
      <LinearGradient
        colors={[Scrim.top, Scrim.mid, Scrim.bottom]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <Animated.View style={[s.kickerRow, { top: insetTop + 5 }, kickerFade]} pointerEvents="none">
        <Text style={s.kicker} numberOfLines={1}>{kicker}</Text>
      </Animated.View>

      <Animated.View style={s.identity} pointerEvents="none">
        <Animated.View style={titleFade}>
          <Text style={s.title} numberOfLines={2}>{title}</Text>
          <Text style={s.sub} numberOfLines={1}>{sub}</Text>
        </Animated.View>
      </Animated.View>

      {/* The collapsed state. Solid surface, so whatever scrolls beneath it is hidden. */}
      <Animated.View style={[s.pinned, pinnedFade]}>
        {stopPhoto
          ? <Photo source={stopPhoto} style={s.pinnedThumb} />
          : <ImagePlaceholder style={s.pinnedThumb} glyphSize={15} />}
        <View style={s.pinnedText}>
          <Text style={s.pinnedName} numberOfLines={1}>{stopName}</Text>
          <Text style={s.pinnedDates} numberOfLines={1}>{stopDates}</Text>
        </View>
        <StopDots count={stopCount} index={stopIndex} onPress={onStopPress} tint={t.action} idle={t.textDisabled} />
      </Animated.View>
    </Animated.View>
  );
}

/**
 * The only swipe hint the rail gets — no arrows. The active dot widens to 16 rather than
 * changing size, so the row's height never shifts.
 */
export function StopDots({
  count, index, onPress, tint, idle,
}: { count: number; index: number; onPress: (i: number) => void; tint: string; idle: string }) {
  const [s] = useStyles();
  return (
    <View style={s.dots}>
      {Array.from({ length: count }).map((_, i) => (
        <Pressable
          key={i}
          onPress={() => onPress(i)}
          accessibilityRole="button"
          accessibilityLabel={`Stop ${i + 1} of ${count}`}
          accessibilityState={{ selected: i === index }}
          // The dot is 5px; the tap target has to be 44. Generous slop rather than a bigger
          // dot, because the row's height is what keeps the pinned bar at 62.
          hitSlop={{ top: 19, bottom: 19, left: 6, right: 6 }}
          style={[s.dot, { width: i === index ? 16 : 5, backgroundColor: i === index ? tint : idle }]}
        />
      ))}
    </View>
  );
}

const useStyles = createThemedStyles((t) => ({
  hero: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    overflow: 'hidden',
    backgroundColor: '#1B2A24',   // behind the photo while it decodes; never visible after
  },

  kickerRow: { position: 'absolute', left: Gutter, right: Gutter, flexDirection: 'row', alignItems: 'center' },
  kicker: {
    fontSize: 10.5, lineHeight: 10.5,
    fontFamily: 'DMSans-SemiBold', fontWeight: '600' as const,
    letterSpacing: 1.47, textTransform: 'uppercase' as const,
    color: 'rgba(255,255,255,0.75)',
  },

  // 74 from the bottom clears the 62px pinned bar with 12 to spare.
  identity: { position: 'absolute', left: Gutter, right: Gutter, bottom: 74 },
  title: { ...Typography.roles.hero, color: Core.onPhoto },
  sub: {
    fontSize: 12.5, lineHeight: 12.5,
    fontFamily: 'DMSans', fontWeight: '400' as const,
    color: Core.onPhoto2, marginTop: Spacing.sm,
  },

  pinned: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: PINNED_BAR_H,
    backgroundColor: t.surface,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.rowPad,
    paddingHorizontal: 18,
  },
  pinnedThumb: { width: 36, height: 36, borderRadius: 11 },
  pinnedText: { flex: 1, minWidth: 0 },
  pinnedName: {
    fontSize: 14, lineHeight: 17,
    fontFamily: 'DMSans-Bold', fontWeight: '700' as const,
    letterSpacing: -0.3, color: t.text,
  },
  pinnedDates: {
    fontSize: 10.5, lineHeight: 13,
    fontFamily: 'DMSans', fontWeight: '400' as const,
    color: t.textMuted, marginTop: 1,
  },

  dots: { flexDirection: 'row', gap: 4, flexShrink: 0 },
  dot: { height: 5, borderRadius: 3 },
}));
