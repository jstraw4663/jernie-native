// The active stop card, and the collapsed header bar. One view, not two.
//
// CUSTOM — registered in reference/custom-components.md.
//
// The design cross-fades: the card fades out, the bar fades in. On device that read as two
// separate objects, one dying and one arriving. This is the same object the whole way — it
// widens to the screen, squares its corners, walks its thumbnail from the right edge to the
// left, drops its status line and grows its dots, and comes to rest as the header.
//
// It is a second drawing of the card rather than the card itself because the card lives
// inside the rail's horizontal ScrollView, and nothing in there can travel to the top of the
// screen and go full-bleed. The two are laid out from the same `STOP_CARD_METRICS`, so at
// rest they are pixel-identical — which is what lets the swap between them be invisible:
//
//   scrollY === 0   the rail's real card is on screen, this is not
//   scrollY  >  0   this is on screen, the rail's real card is not
//
// Both sides read that one threshold off the same shared value in the same frame, so there
// is never a gap and never a doubled shadow. The rail keeps the swipe; this keeps the shape.
import { useWindowDimensions } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { Shadow, Spacing } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { ImagePlaceholder, Photo, STOP_CARD_METRICS as M, stopCardWidth } from '@/src/ui';
import { CARD_TOP, PINNED_BAR_H, RANGE, barTop, cardLeft } from './collapse';
import { StopDots, dotsWidth } from './StopDots';

/** Gutter either side of the bar's contents, and the gap before the dots. */
const BAR_PAD = 18;
const BAR_GAP = 10;

/** What the thumbnail becomes: a 36px tile on the left, `Radius.tile` minus a hair. */
const BAR_THUMB = 36;
const BAR_THUMB_RADIUS = 11;

/** Name plus the gap plus dates — the block the bar centres vertically. */
const TEXT_BLOCK_H = 17.6 + 5 + 11.5;

/** What the card sheds on the way in, and what the bar grows. Worklets: read on the UI thread. */
function shedAt(y: number): number {
  'worklet';
  const p = interpolate(y, [0, RANGE], [0, 1], Extrapolation.CLAMP);
  return interpolate(p, [0, 0.28], [1, 0], Extrapolation.CLAMP);
}
function arriveAt(y: number): number {
  'worklet';
  const p = interpolate(y, [0, RANGE], [0, 1], Extrapolation.CLAMP);
  return interpolate(p, [0.62, 1], [0, 1], Extrapolation.CLAMP);
}

export interface StopMorphProps {
  name: string;
  dates: string;
  kicker: string;
  status: string;
  statusTone: 'accent' | 'warning';
  count: string;
  photo?: string;
  stopCount: number;
  index: number;
  insetTop: number;
  scrollY: SharedValue<number>;
  onStopPress: (i: number) => void;
}

export function StopMorph({
  name, dates, kicker, status, statusTone, count, photo,
  stopCount, index, insetTop, scrollY, onStopPress,
}: StopMorphProps) {
  const [s, t] = useStyles();
  const { width } = useWindowDimensions();

  const tone = statusTone === 'warning' ? t.warning : t.action;

  const restX = cardLeft(width);
  const endY = barTop(insetTop);
  // The card is a share of the screen, so this has to be measured off the same screen the
  // card measured itself against — not off a constant.
  const cardW = stopCardWidth(width);
  // Where the thumbnail starts: hard against the card's right padding, inside its border.
  const restThumbX = cardW - M.border * 2 - M.padH - M.thumb;
  const barTextX = BAR_PAD + BAR_THUMB + Spacing.rowPad;
  const restTextW = cardW - M.border * 2 - M.padH * 2 - M.gap - M.thumb;
  const barTextW = Math.max(60, width - barTextX - BAR_PAD - dotsWidth(stopCount) - BAR_GAP);

  // The card's silhouette. `width`/`height` are laid out every frame, which is the same cost
  // the hero above already pays for its own height — one view, not a tree.
  const frame = useAnimatedStyle(() => {
    const p = interpolate(scrollY.value, [0, RANGE], [0, 1], Extrapolation.CLAMP);
    return {
      // Off entirely while the rail owns the card, so the two are never both drawn.
      opacity: scrollY.value > 0.5 ? 1 : 0,
      width: interpolate(p, [0, 1], [cardW, width]),
      height: interpolate(p, [0, 1], [M.height, PINNED_BAR_H]),
      borderRadius: interpolate(p, [0, 1], [M.radius, 0]),
      // The selection ring belongs to a card floating on a photo. A full-bleed bar with a
      // 1.5px teal line down both screen edges is not that, so it goes before the shape does.
      borderWidth: interpolate(p, [0, 0.55], [M.border, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(p, [0, 1], [restX, 0]) },
        { translateY: interpolate(p, [0, 1], [CARD_TOP, endY]) },
      ],
      shadowOpacity: interpolate(p, [0, 0.8], [0.14, 0], Extrapolation.CLAMP),
      shadowRadius: interpolate(p, [0, 0.8], [30, 8], Extrapolation.CLAMP),
      elevation: interpolate(p, [0, 0.8], [9, 0], Extrapolation.CLAMP),
      // Only the dots are interactive, and only once they exist.
      pointerEvents: p > 0.62 ? 'box-none' : 'none',
    };
  });

  // Right edge to left edge. The longest journey anything on this screen makes, and the one
  // that sells the whole thing as a rearrangement rather than a substitution.
  const thumb = useAnimatedStyle(() => {
    const p = interpolate(scrollY.value, [0, RANGE], [0, 1], Extrapolation.CLAMP);
    return {
      width: interpolate(p, [0, 1], [M.thumb, BAR_THUMB]),
      height: interpolate(p, [0, 1], [M.thumb, BAR_THUMB]),
      borderRadius: interpolate(p, [0, 1], [M.thumbRadius, BAR_THUMB_RADIUS]),
      transform: [
        { translateX: interpolate(p, [0, 1], [restThumbX, BAR_PAD]) },
        { translateY: interpolate(p, [0, 1], [M.padV, (PINNED_BAR_H - BAR_THUMB) / 2]) },
      ],
    };
  });

  // The photograph inside it keeps a fixed 54px box and *scales* to fit, rather than being
  // resized along with the tile. `expo-image` reloads on every `bounds` change and cancels the
  // request in flight, so an image in an animating box re-issues its download every frame.
  // A scale is not a bounds change. See the note at the top of src/ui/Photo.tsx.
  const thumbInner = useAnimatedStyle(() => {
    const p = interpolate(scrollY.value, [0, RANGE], [0, 1], Extrapolation.CLAMP);
    return { transform: [{ scale: interpolate(p, [0, 1], [1, BAR_THUMB / M.thumb]) }] };
  });

  // The name and dates keep the card's type sizes in the bar — 16/11.5, not the reference
  // bar's 14/10.5. Animating `fontSize` re-measures the text every frame, and a text block
  // that scales drags its own line spacing with it. The larger size reads fine at 62 tall.
  const text = useAnimatedStyle(() => {
    const p = interpolate(scrollY.value, [0, RANGE], [0, 1], Extrapolation.CLAMP);
    return {
      width: interpolate(p, [0, 1], [restTextW, barTextW]),
      transform: [
        { translateX: interpolate(p, [0, 1], [M.padH, barTextX]) },
        { translateY: interpolate(p, [0, 1], [M.headTop, (PINNED_BAR_H - TEXT_BLOCK_H) / 2]) },
      ],
    };
  });

  // "Stop 2 of 3" and the status line are what the bar has no room for. Both are gone before
  // the shrinking height would clip them — the fade finishes at p=0.28, which is the exact
  // point the box gets shorter than the status row's bottom edge.
  //
  // Four hooks for two pairs of identical curves, rather than two styles used twice: a
  // Reanimated style belongs to one view. Sharing one across two mounts them both against
  // the same node and only one of them animates.
  const shedKicker = useAnimatedStyle(() => ({ opacity: shedAt(scrollY.value) }));
  const shedFoot   = useAnimatedStyle(() => ({ opacity: shedAt(scrollY.value) }));

  // Late, so nothing crossfades against the status line it replaces.
  const arriveDots = useAnimatedStyle(() => ({ opacity: arriveAt(scrollY.value) }));
  const arriveLine = useAnimatedStyle(() => ({ opacity: arriveAt(scrollY.value) }));

  return (
    <Animated.View style={[s.morph, { borderColor: tone }, frame]}>
      <Animated.Text style={[s.kicker, { color: t.action }, shedKicker]} numberOfLines={1}>{kicker}</Animated.Text>

      <Animated.View style={[s.thumb, thumb]}>
        <Animated.View style={[s.thumbInner, thumbInner]}>
          {photo
            ? <Photo source={photo} style={s.fill} />
            : <ImagePlaceholder style={s.fill} glyphSize={18} />}
        </Animated.View>
      </Animated.View>

      <Animated.View style={[s.text, text]}>
        <Animated.Text style={s.name} numberOfLines={1}>{name}</Animated.Text>
        <Animated.Text style={s.dates} numberOfLines={1}>{dates}</Animated.Text>
      </Animated.View>

      <Animated.View style={[s.foot, shedFoot]} pointerEvents="none">
        <Animated.Text style={[s.status, { color: tone }]} numberOfLines={1}>{status}</Animated.Text>
        <Animated.Text style={s.count} numberOfLines={1}>{count}</Animated.Text>
      </Animated.View>

      <Animated.View style={[s.dots, arriveDots]}>
        <StopDots count={stopCount} index={index} onPress={onStopPress} tint={t.action} idle={t.textDisabled} />
      </Animated.View>

      <Animated.View style={[s.hairline, arriveLine]} pointerEvents="none" />
    </Animated.View>
  );
}

const useStyles = createThemedStyles((t) => ({
  // No `overflow: 'hidden'` — iOS drops a shadow from any view that clips, and nothing
  // actually escapes: every part that would has finished fading before the box is short
  // enough to cut it.
  morph: {
    position: 'absolute',
    top: 0, left: 0,
    backgroundColor: t.surface,
    shadowColor: Shadow.card.shadowColor,
    shadowOffset: Shadow.card.shadowOffset,
  },

  // All five children are absolutely positioned, so the box can change shape without any of
  // them re-flowing. Each one's `left`/`top` is zero and its real position is a translate.
  // The one child that never moves — it is gone long before the box changes shape.
  kicker: {
    position: 'absolute', left: M.padH, top: M.padV,
    fontSize: 9.5, lineHeight: 9.5,
    fontFamily: 'DMSans-Bold', fontWeight: '700' as const,
    letterSpacing: 1.14, textTransform: 'uppercase' as const,
  },

  // The tile animates its size and does the clipping; the photograph inside it does not.
  thumb: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' },
  thumbInner: { width: M.thumb, height: M.thumb, transformOrigin: 'top left' },
  fill:  { width: '100%', height: '100%' },

  text:  { position: 'absolute', left: 0, top: 0, gap: 5 },
  name:  { fontSize: 16, lineHeight: 17.6, fontFamily: 'DMSans-Bold', fontWeight: '700' as const, letterSpacing: -0.35, color: t.text },
  dates: { fontSize: 11.5, lineHeight: 11.5, fontFamily: 'DMSans', fontWeight: '400' as const, color: t.textMuted },

  foot: {
    position: 'absolute',
    left: M.padH, right: M.padH, top: M.footTop,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingTop: 9,
    borderTopWidth: 1, borderTopColor: t.borderSoft,
  },
  status: { fontSize: 11, lineHeight: 11, fontFamily: 'DMSans-SemiBold', fontWeight: '600' as const },
  count:  { fontSize: 10.5, lineHeight: 10.5, fontFamily: 'DMSans', fontWeight: '400' as const, color: t.textFaint, marginLeft: 'auto' },

  dots: {
    position: 'absolute',
    right: BAR_PAD, top: 0, bottom: 0,
    justifyContent: 'center',
  },

  hairline: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: 1,
    backgroundColor: t.border,
  },
}));
