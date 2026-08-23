// The render half of the photo seam (the resolve half is `src/lib/images.ts`).
//
// Everything that shows a photograph goes through here, so `expo-image`'s caching and
// fade-in are set once rather than per call site, and so a missing photo is a designed
// placeholder rather than an empty grey box. Plain RN `Image` re-fetches and flickers on
// scroll, which is why the mapping names `expo-image`.
//
// **Never put one of these in a box whose width or height is animated.** `ImageView.swift`
// reloads on every `bounds` change, and `reload()` cancels the request in flight — so an
// image inside a resizing container re-issues its download every frame and can fail to ever
// finish it, leaving the previous photo on screen. Animate a `scale` on a fixed-size box, or
// let a clipping parent crop a fixed-size image. Both the home hero and `StopMorph`'s
// thumbnail do the latter; see HomeHeader.tsx.
import { Image } from 'expo-image';
import type { Icon } from 'phosphor-react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import { PLACE_ICON } from '@/src/design/icons';
import { Animation } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';

export interface PhotoProps {
  /** Resolved by `resolvePhoto()` — never a literal URL written into a screen. */
  source?: string;
  /** Drawn when `source` is undefined. Defaults to the place pin. */
  Glyph?: Icon;
  glyphSize?: number;
  /** Size and radius live here; the photo fills whatever box it is given. */
  style?: StyleProp<ViewStyle>;
  /** Crossfade in ms when the source changes. Defaults to `fast`. A hero wants `normal` —
   *  swapping the biggest image on the screen at 175ms reads as a glitch, but `slow` reads
   *  as waiting. */
  transition?: number;
  accessibilityLabel?: string;
  testID?: string;
}

export function Photo({ source, Glyph, glyphSize, style, transition, accessibilityLabel, testID }: PhotoProps) {
  const [s] = useStyles();

  if (!source) {
    return <ImagePlaceholder Glyph={Glyph} glyphSize={glyphSize} style={style} testID={testID} />;
  }

  return (
    <View style={[s.box, style]} testID={testID}>
      <Image
        source={{ uri: source }}
        // The view is reused when the subject changes — a different stop, a different place.
        // Without this expo-image keeps the last image it successfully loaded on screen until
        // the new one is decoded, which on the home hero meant the previous stop's photograph
        // sitting under the new stop's name. Blank while it loads is honest; the wrong
        // photograph is not. Resetting only happens when the key *changes*, so a first mount
        // is unaffected.
        recyclingKey={source}
        style={s.fill}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={transition ?? Animation.duration.fast}
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
}

/**
 * What a photo slot looks like with no photo in it: a sunken tile carrying the subject's
 * own glyph. Exported on its own for the places that know up front there is no image —
 * a skeleton, a form preview.
 */
export function ImagePlaceholder({
  Glyph = PLACE_ICON, glyphSize, style, testID,
}: Pick<PhotoProps, 'Glyph' | 'glyphSize' | 'style' | 'testID'>) {
  const [s, t] = useStyles();
  return (
    <View style={[s.box, s.placeholder, style]} testID={testID}>
      <Glyph size={glyphSize ?? 18} color={t.textFaint} weight="regular" />
    </View>
  );
}

const useStyles = createThemedStyles((t) => ({
  box:  { overflow: 'hidden', backgroundColor: t.surfaceMuted },
  fill: { width: '100%', height: '100%' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
}));
