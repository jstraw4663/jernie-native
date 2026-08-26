// The screen's ONE carousel. The design spec's rule is "one carousel maximum per screen":
// the carousel is editorial, the grid is exhaustive, and six competing rails made neither.
//
// Its subtitle states the real basis for the selection. The canvas reads "Open now, within
// 15 minutes of Atlantic Oceanside"; nothing in the data supports either half — 6 of 54
// places carry coordinates and PlaceEnrichment.hours is a free-form string[] — so the line
// says what is actually true, which is that these are the curator's must-dos.
import { ScrollView, Text, View } from 'react-native';
import { Gutter, Spacing, Typography } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { FeaturedPlaceCard } from './PlaceCard';
import type { Place } from '@/src/types';

/** One card in a horizontal rail reads as a layout bug, so the section hides below this. */
export const FEATURED_MIN = 2;

interface ExploreFeaturedRowProps {
  places: Place[];
  /** The city the stop filter is on, or undefined for "All stops". */
  stopCity?: string;
  getPhotoUrl: (place: Place) => string | undefined;
  addedPlaceIds: Set<string>;
  onPlacePress: (place: Place) => void;
}

export function ExploreFeaturedRow({
  places, stopCity, getPhotoUrl, addedPlaceIds, onPlacePress,
}: ExploreFeaturedRowProps) {
  const [s] = useStyles();
  if (places.length < FEATURED_MIN) return null;

  return (
    <View>
      <View style={s.header}>
        <Text style={s.title} accessibilityRole="header">Worth the detour</Text>
        <Text style={s.count}>{places.length} places</Text>
      </View>
      <Text style={s.basis}>
        {stopCity ? `Hand-picked in ${stopCity}` : 'Hand-picked across the trip'}
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.rail}
      >
        {places.map(place => (
          <FeaturedPlaceCard
            key={place.id}
            testID={`featured-${place.id}`}
            place={place}
            photoUrl={getPhotoUrl(place)}
            isAdded={addedPlaceIds.has(place.id)}
            onPress={() => onPlacePress(place)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = createThemedStyles(t => ({
  header: {
    paddingHorizontal: Gutter,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  title: { ...Typography.roles.section, color: t.text },
  count: { ...Typography.roles.sub, color: t.textFaint },
  basis: { ...Typography.roles.sub, color: t.textMuted, paddingHorizontal: Gutter, marginBottom: 11 },
  rail: { paddingHorizontal: Gutter, paddingBottom: Spacing.xs, gap: Spacing.sm + 2 },
}));
