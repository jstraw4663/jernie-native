// The two card sizes on Explore, sharing one vocabulary: a photo, the place's name, and a
// meta line built from whatever fields that place actually carries.
//
// The canvas draws a save circle on both. There is no saved-places concept in the schema and
// redesign work may not add one, so it is omitted rather than faked — adding to the itinerary
// stays on the detail sheet, which is where the day picker lives.
//
// Reference: docs/design/Jernie Screen.dc.html, the `isExplore` block.
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { StarIcon } from 'phosphor-react-native/src/icons/Star';
import { Pressable, Text, View } from 'react-native';
import { iconFor } from '@/src/design/icons';
import { Core, PRESSED_OPACITY, Radius, Scrim, Spacing, Typography } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { Photo, tap } from '@/src/ui';
import type { Place } from '@/src/types';

/** Featured card: 172 wide with a 116-tall photo. Grid card: half a row with a 106-tall one. */
export const FEATURED_CARD_WIDTH = 172;
const FEATURED_PHOTO_HEIGHT = 116;
const GRID_PHOTO_HEIGHT = 106;

export interface PlaceCardProps {
  place: Place;
  photoUrl: string | undefined;
  isAdded: boolean;
  onPress: () => void;
  testID?: string;
}

/** " · "-joined from the fields this place has. A place with none gets no line at all. */
export function placeMetaLine(place: Place): string {
  const parts: string[] = [];
  if (place.subcategory) parts.push(place.subcategory);
  if (place.rating != null) parts.push(`★ ${place.rating}`);
  if (place.price) parts.push(place.price);
  return parts.join(' · ');
}

function accessibilityLabelFor(place: Place, isAdded: boolean): string {
  return isAdded ? `${place.name}, already added` : place.name;
}

export function FeaturedPlaceCard({ place, photoUrl, isAdded, onPress, testID }: PlaceCardProps) {
  const [s] = useStyles();
  const Glyph = iconFor(place.category, place.subcategory);
  const meta = placeMetaLine(place);

  return (
    <Pressable
      testID={testID}
      onPress={() => { tap(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabelFor(place, isAdded)}
      style={({ pressed }) => [s.featured, pressed && s.pressed]}
    >
      <View style={s.featuredPhotoWrap}>
        <Photo source={photoUrl} Glyph={Glyph} glyphSize={22} style={s.fill} />
        {/* The one on-photo element left after the save circle came out. `Scrim.top` rather
            than `Core.onPhotoChip`: that token is 18% white, which cannot carry white type
            over a bright photograph. `expo-blur` is what photo-scrim.md would put behind it;
            it is not installed, and a 50% scrim is legible without it. */}
        <View style={s.tag}>
          <Glyph size={11} color={Core.onPhoto} weight="fill" />
          <Text style={s.tagLabel} numberOfLines={1}>{place.category}</Text>
        </View>
      </View>
      <Text style={s.name} numberOfLines={1}>{place.name}</Text>
      {meta ? <Text style={s.meta} numberOfLines={1}>{meta}</Text> : null}
    </Pressable>
  );
}

export function GridPlaceCard({ place, photoUrl, isAdded, onPress, testID }: PlaceCardProps) {
  const [s, t] = useStyles();
  const Glyph = iconFor(place.category, place.subcategory);
  const meta = placeMetaLine(place);

  // The canvas's coloured note line. It carries itinerary state, which is the only thing on
  // this screen worth colouring — and both states are the accent, because a must-do is not a
  // warning and neither is a secured plan. Absent means absent: the row's height is not
  // reserved, so a card with nothing to say is shorter rather than padded.
  const note = isAdded
    ? { Icon: CheckIcon, label: 'Added', weight: 'bold' as const }
    : place.must
      ? { Icon: StarIcon, label: 'Must do', weight: 'fill' as const }
      : null;

  return (
    <Pressable
      testID={testID}
      onPress={() => { tap(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabelFor(place, isAdded)}
      style={({ pressed }) => [s.grid, pressed && s.pressed]}
    >
      <Photo source={photoUrl} Glyph={Glyph} glyphSize={20} style={s.gridPhoto} />
      <Text style={s.name} numberOfLines={2}>{place.name}</Text>
      {meta ? <Text style={s.meta} numberOfLines={1}>{meta}</Text> : null}
      {note ? (
        <View style={s.note}>
          <note.Icon size={11} color={t.action} weight={note.weight} />
          <Text style={s.noteLabel} numberOfLines={1}>{note.label}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const useStyles = createThemedStyles(t => ({
  featured: { width: FEATURED_CARD_WIDTH },
  featuredPhotoWrap: {
    height: FEATURED_PHOTO_HEIGHT,
    borderRadius: Radius.row,
    overflow: 'hidden',
  },
  fill: { width: '100%', height: '100%' },

  grid: { flex: 1 },
  gridPhoto: { height: GRID_PHOTO_HEIGHT, borderRadius: Radius.row },

  tag: {
    position: 'absolute',
    left: Spacing.sm,
    bottom: Spacing.sm,
    height: 22,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Scrim.top,
  },
  // White on a photograph is white in both themes — the scrim keeps it legible, not the
  // palette. Same reasoning as every other on-photo label in the app.
  tagLabel: { ...Typography.roles.sub, color: Core.onPhoto, textTransform: 'capitalize' },

  name: { ...Typography.roles.row, color: t.text, marginTop: Spacing.sm },
  meta: { ...Typography.roles.sub, color: t.textMuted, marginTop: Spacing.xs, textTransform: 'capitalize' },

  note: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  noteLabel: { ...Typography.roles.sub, color: t.action },

  pressed: { opacity: PRESSED_OPACITY },
}));
