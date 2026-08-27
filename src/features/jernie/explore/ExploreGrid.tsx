// "Everything nearby" — the exhaustive half of Explore, two columns over one FlashList.
//
// One scroll surface for the whole screen: the featured carousel and both section headings
// ride in ListHeaderComponent rather than in a ScrollView wrapped around this, which would
// defeat recycling on the longest list in the app.
//
// The canvas sorts by Distance. 6 of 54 places carry coordinates and expo-location is not
// installed, so the control keeps the canvas's shape and offers the sorts the data supports.
import { FlashList } from '@shopify/flash-list';
import { CaretUpDownIcon } from 'phosphor-react-native/src/icons/CaretUpDown';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { SORT_OPTIONS } from '@/src/domain/explore';
import type { SortKey } from '@/src/domain/explore';
import { Gutter, Spacing, Typography } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { ChipDropdown } from '@/src/ui';
import { GridPlaceCard } from './PlaceCard';
import type { Place } from '@/src/types';

/** Canvas: `gap: 12px 10px`. Half the column gap goes on each cell's inner edge. */
const COLUMN_GAP = 10;
const ROW_GAP = Spacing.md;

interface ExploreGridProps {
  places: Place[];
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  getPhotoUrl: (place: Place) => string | undefined;
  addedPlaceIds: Set<string>;
  onPlacePress: (place: Place) => void;
  /** The featured carousel. Rides in the list header so there is one scroll surface. */
  header?: ReactNode;
  /** Shown in place of the grid when nothing matches — a PromptRow, never a grey sentence. */
  empty?: ReactNode;
}

export function ExploreGrid({
  places, sort, onSortChange, getPhotoUrl, addedPlaceIds, onPlacePress, header, empty,
}: ExploreGridProps) {
  const [s, t] = useStyles();
  const sortLabel = SORT_OPTIONS.find(option => option.value === sort)?.label ?? SORT_OPTIONS[0].label;

  const listHeader = (
    <View>
      {header}
      <View style={s.header}>
        <Text style={s.title} accessibilityRole="header">Everything nearby</Text>
        <ChipDropdown
          testID="explore-sort"
          label={sortLabel}
          icon={<CaretUpDownIcon size={11} color={t.textMuted} weight="regular" />}
          options={SORT_OPTIONS.map(option => ({ id: option.value, label: option.label }))}
          selectedId={sort}
          onSelect={id => onSortChange(id as SortKey)}
        />
      </View>
    </View>
  );

  return (
    <FlashList
      testID="explore-grid"
      data={places}
      numColumns={2}
      keyExtractor={place => place.id}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={empty ? <View style={s.empty}>{empty}</View> : null}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      renderItem={({ item, index }) => (
        <View style={[
          s.cell,
          // FlashList has no columnWrapperStyle, so the column gutter lives on the cells:
          // half of it on each one's inner edge, which keeps both columns the same width.
          index % 2 === 0 ? s.cellLeft : s.cellRight,
        ]}>
          <GridPlaceCard
            testID={`grid-${item.id}`}
            place={item}
            photoUrl={getPhotoUrl(item)}
            isAdded={addedPlaceIds.has(item.id)}
            onPress={() => onPlacePress(item)}
          />
        </View>
      )}
    />
  );
}

const useStyles = createThemedStyles(t => ({
  content: { paddingBottom: Spacing.xl },
  header: {
    paddingHorizontal: Gutter,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
    marginBottom: 11,
  },
  title: { ...Typography.roles.section, color: t.text },

  cell: { flex: 1, marginBottom: ROW_GAP },
  cellLeft:  { paddingLeft: Gutter, paddingRight: COLUMN_GAP / 2 },
  cellRight: { paddingLeft: COLUMN_GAP / 2, paddingRight: Gutter },

  empty: { paddingHorizontal: Gutter, paddingTop: Spacing.sm },
}));
