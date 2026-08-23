// The home hero: one photograph, one trip name, one scroll value.
//
// Sits ABOVE the scroll view so content passes underneath it rather than over it. The photo
// re-crops in place: the container's height animates and `contentFit="cover"` re-crops to
// fill, so the image is never smaller than its box and no band can appear above it.
//
// It no longer owns the collapsed stop bar. That is `StopMorph`, which is the active stop
// card stretched — the header just gets out of its way and leaves it the bottom 62px.
// Reference: docs/design/Jernie Screen.dc.html (the home hero) + reference/collapse.md
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { Animation, Core, Gutter, Scrim, Typography } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { ImagePlaceholder, Photo } from '@/src/ui';
import { HERO_MAX, RANGE, TITLE_BOTTOM, TITLE_MIN_SCALE, TITLE_SHIFT, heroMin } from './collapse';

export interface HomeHeaderProps {
  /** Uppercase, e.g. "DAY 4 OF 8". */
  kicker: string;
  title: string;
  sub: string;
  photo?: string;
  insetTop: number;
  scrollY: SharedValue<number>;
}

export function HomeHeader({ kicker, title, sub, photo, insetTop, scrollY }: HomeHeaderProps) {
  const [s] = useStyles();
  const min = heroMin(insetTop);

  const hero = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [0, RANGE], [HERO_MAX, min], Extrapolation.CLAMP),
  }));

  // The trip name is the one thing that survives. It is bottom-anchored, so the shrinking
  // hero carries it most of the way for free; this only shrinks it and nudges the last
  // 18px. Scale rather than fontSize — animating fontSize re-lays-out the text every frame,
  // and 34px of Fraunces downsampled to 20 stays crisp because it is a downsample.
  const titleShrink = useAnimatedStyle(() => {
    const p = interpolate(scrollY.value, [0, RANGE], [0, 1], Extrapolation.CLAMP);
    return {
      transform: [
        { translateY: p * TITLE_SHIFT },
        { scale: interpolate(p, [0, 1], [1, TITLE_MIN_SCALE]) },
      ],
    };
  });

  // The dates and the day count are the parts that stop being worth their space. Gone by
  // y=64, well before the bar arrives, so the two never overlap. Multipliers are the canvas's.
  const subFade = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, RANGE / 2.2], [1, 0], Extrapolation.CLAMP),
  }));
  const kickerFade = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, RANGE / 1.6], [1, 0], Extrapolation.CLAMP),
  }));

  // The resting scrim's mid stop is 12% — deliberately light, so the photograph reads. That
  // is not enough behind 20px of white serif once the photo is a 50px strip, and the strip
  // is exactly where the gradient is thinnest. This second one arrives only for the strip.
  const stripScrim = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [RANGE * 0.55, RANGE], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View style={[s.hero, hero]} pointerEvents="box-none">
      {photo
        ? <Photo source={photo} style={StyleSheet.absoluteFill} transition={Animation.duration.normal} />
        : <ImagePlaceholder style={StyleSheet.absoluteFill} glyphSize={34} />}

      {/* Three stops, not two. The mid stop is what stops the gradient banding across a
          bright sky — see reference/photo-scrim.md. */}
      <LinearGradient
        colors={[Scrim.top, Scrim.mid, Scrim.bottom]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <Animated.View style={[StyleSheet.absoluteFill, stripScrim]} pointerEvents="none">
        <LinearGradient
          colors={['rgba(16,24,20,0.66)', 'rgba(16,24,20,0.06)']}
          locations={[0, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View style={[s.kickerRow, { top: insetTop + 5 }, kickerFade]} pointerEvents="none">
        <Text style={s.kicker} numberOfLines={1}>{kicker}</Text>
      </Animated.View>

      {/* Two blocks, not one. The name has to be positioned independently of the line below
          it, because the line below it goes away and the name does not. */}
      <Animated.View style={[s.titleRow, titleShrink]} pointerEvents="none">
        {/* One line. Two would push the first line up under the status bar at full collapse,
            since the block is anchored by its bottom edge. */}
        <Text style={s.title} numberOfLines={1}>{title}</Text>
      </Animated.View>

      <Animated.View style={[s.subRow, subFade]} pointerEvents="none">
        <Text style={s.sub} numberOfLines={1}>{sub}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const useStyles = createThemedStyles(() => ({
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

  // Anchored by the bottom edge and scaled from it, so the shrink never moves the baseline
  // sideways or drops the name onto the line below.
  titleRow: {
    position: 'absolute',
    left: Gutter, right: Gutter, bottom: TITLE_BOTTOM,
    transformOrigin: 'left bottom',
  },
  title: { ...Typography.roles.hero, color: Core.onPhoto },

  // 74 from the bottom clears the 62px bar with 12 to spare.
  subRow: { position: 'absolute', left: Gutter, right: Gutter, bottom: 74 },
  sub: {
    fontSize: 12.5, lineHeight: 12.5,
    fontFamily: 'DMSans', fontWeight: '400' as const,
    color: Core.onPhoto2,
  },
}));
