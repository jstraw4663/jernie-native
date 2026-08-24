// The top 190px of every detail sheet: a photograph, or type on a dark ground.
//
// Two modes because the app has two kinds of subject. A **place** resolves a photo through
// the seam and gets the canvas's hero verbatim. A **booking** has no photo — there is no
// booking subject in `src/lib/images.ts`, and Session 11 owns the provider — so it gets its
// route or its dates in large type instead. A flight headed by a photo of the town says
// less than "BGR → CLT" does, so this is the permanent answer for Travel rather than a
// placeholder waiting for Session 11.
//
// Both modes are dark, and both use `Core.onPhoto*` for their text. The grabber lives in
// here rather than in gorhom's handle slot, because the canvas draws it *over* the hero and
// the default handle would put a white strip above the photograph.
// Reference: docs/design/Jernie Screen.dc.html, the open sheet.
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { iconFor } from '@/src/design/icons';
import { Core, Gutter, PRESSED_OPACITY, Radius, Scrim, Spacing } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { Photo } from '@/src/ui';
import type { HeroModel } from './types';

export const HERO_HEIGHT = 190;

/**
 * The hero's ground is dark in **both** themes — it behaves like photography, which is what
 * `Core.onPhoto` / `onPhoto2` are for. `Core` is the static light palette by construction,
 * so this stays #1B1B1B when the app unpins dark mode. Do not swap it for `useTheme().text`,
 * which is cream on the dark palette.
 */
const HERO_GROUND = Core.text;

/** The canvas's close-button chip: a dark scrim, so it holds against a bright photograph
 *  where `--on-photo-chip`'s 18% white would disappear. */
const CLOSE_SCRIM = 'rgba(20,20,20,0.55)';

export function DetailHero({ hero, title, onClose }: { hero: HeroModel; title: string; onClose: () => void }) {
  const [s] = useStyles();

  return (
    <View style={s.hero}>
      {hero.kind === 'photo' ? (
        <>
          <Photo
            source={hero.source}
            Glyph={iconFor(hero.glyphCategory)}
            glyphSize={34}
            style={StyleSheet.absoluteFill}
            transition={0}
            accessibilityLabel={title}
          />
          {/* Only over a real photograph. The placeholder is already a flat sunken tile and
              a scrim on top of it just makes it muddy. */}
          {hero.source ? (
            <LinearGradient
              colors={[Scrim.top, Scrim.mid, Scrim.bottom]}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
        </>
      ) : (
        <View style={s.typeBody}>
          {hero.badge ? (
            <View style={s.badge}>
              {hero.badgeTone === 'accent' ? (
                <CheckCircleIcon size={11} color={Core.onPhoto} weight="fill" />
              ) : null}
              <Text style={s.badgeTxt}>{hero.badge}</Text>
            </View>
          ) : null}
          <Text style={s.lead} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{hero.lead}</Text>
          {hero.sub ? <Text style={s.sub} numberOfLines={1}>{hero.sub}</Text> : null}
        </View>
      )}

      <View style={s.grabber} pointerEvents="none" />

      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={8}
        style={({ pressed }) => [s.close, pressed && s.pressed]}
      >
        <XIcon size={14} color={Core.onPhoto} weight="bold" />
      </Pressable>
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  hero: { height: HERO_HEIGHT, backgroundColor: HERO_GROUND, overflow: 'hidden' },

  // 38x4 at top:10, centred — the canvas's grabber, drawn over the hero rather than above it.
  grabber: {
    position: 'absolute', top: 10, alignSelf: 'center',
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },

  close: {
    position: 'absolute', top: Spacing.base, right: Spacing.base,
    width: Spacing.xxl, height: Spacing.xxl, borderRadius: Radius.full,
    backgroundColor: CLOSE_SCRIM,
    alignItems: 'center', justifyContent: 'center',
  },
  pressed: { opacity: PRESSED_OPACITY },

  typeBody: { flex: 1, justifyContent: 'flex-end', padding: Gutter, paddingBottom: Spacing.lg },
  badge: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4,
    height: 22, paddingHorizontal: 9, borderRadius: Radius.full,
    backgroundColor: Core.onPhotoChip, marginBottom: 10,
  },
  // Status by glyph, not by colour: there is exactly one accent in this system and a
  // confirmation code is not it. The check is the difference between Confirmed and Booked.
  badgeTxt: { fontSize: 11, lineHeight: 12, fontFamily: 'DMSans-Bold', fontWeight: '700' as const, color: Core.onPhoto },

  lead: { fontSize: 30, lineHeight: 34, fontFamily: 'DMSans-Bold', fontWeight: '700' as const, letterSpacing: -0.6, color: Core.onPhoto },
  sub:  { fontSize: 12.5, lineHeight: 16, fontFamily: 'DMSans', color: Core.onPhoto2, marginTop: 4 },
}));
