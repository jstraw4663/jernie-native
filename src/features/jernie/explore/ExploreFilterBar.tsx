// The Explore tab's one filter bar: the screen title, the stop and type dropdowns, and the
// sliders button that opens the full filter sheet. Provider-free by design — every value it
// needs is a resolved prop, not `useExploreFilters()` — so it stays testable without a
// provider and reusable by Session 8's Map tab.
// Reference: .superpowers/sdd/2026-08-26-explore/task-4-brief.md
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Icon } from 'phosphor-react-native';
import { SlidersHorizontalIcon } from 'phosphor-react-native/src/icons/SlidersHorizontal';
import { Gutter, PRESSED_OPACITY, Radius, Spacing, Typography } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { iconFor, PLACE_ICON } from '@/src/design/icons';
import { ChipDropdown, type DropdownOption } from '@/src/ui/ChipDropdown';
import { tap } from '@/src/ui/haptics';
import { sheetFilterCount, type ExploreFilters, type FilterId } from '@/src/domain/explore';
import type { Stop } from '@/src/types';

// Moved from the screen (Task 7 rewrites that file) — the type dropdown's six options, each
// with the category's own icon. `all` carries no icon, matching the legacy pill row.
const CATEGORY_FILTER_ITEMS: { id: FilterId; label: string; Glyph?: Icon }[] = [
  { id: 'all',        label: 'All' },
  { id: 'restaurant', label: 'Eats',           Glyph: iconFor('food') },
  { id: 'hike',       label: 'Hikes',          Glyph: iconFor('hike') },
  { id: 'bar',        label: 'Bars',           Glyph: iconFor('bars') },
  { id: 'sights',     label: 'Sights & More',  Glyph: iconFor('sight') },
  { id: 'activity',   label: 'Activities',     Glyph: iconFor('activity') },
];

// The 34px sliders button is under the 44px tap-target floor — the same call `Toggle` makes.
const SLIDERS_HIT_SLOP = 5;

export interface ExploreFilterBarProps {
  stops: Stop[];
  filters: ExploreFilters;
  setStop: (id: string | 'all') => void;
  setCategory: (id: FilterId) => void;
  onOpenFilters: () => void;
}

export function ExploreFilterBar({ stops, filters, setStop, setCategory, onOpenFilters }: ExploreFilterBarProps) {
  const [s, t] = useStyles();
  const insets = useSafeAreaInsets();

  const stopOptions = useMemo<DropdownOption[]>(() => [
    { id: 'all', label: 'All stops' },
    ...stops.map((stop) => ({
      id: stop.id,
      label: stop.city,
      icon: <PLACE_ICON size={12} color={t.textMuted} />,
    })),
  ], [stops, t.textMuted]);

  const selectedStop = stops.find((stop) => stop.id === filters.stopId);
  const stopLabel = filters.stopId === 'all' ? 'All stops' : selectedStop?.city ?? 'All stops';

  const typeOptions = useMemo<DropdownOption[]>(() => CATEGORY_FILTER_ITEMS.map((item) => ({
    id: item.id,
    label: item.label,
    icon: item.Glyph ? <item.Glyph size={12} color={t.textMuted} /> : undefined,
  })), [t.textMuted]);

  const selectedType = CATEGORY_FILTER_ITEMS.find((item) => item.id === filters.category);
  const typeLabel = filters.category === 'all' ? 'All types' : selectedType?.label ?? 'All types';

  const filterCount = sheetFilterCount(filters);

  return (
    <View style={[s.container, { paddingTop: insets.top + Spacing.md }]}>
      <Text style={s.title}>Explore</Text>
      <View style={s.row}>
        <ChipDropdown
          label={stopLabel}
          options={stopOptions}
          selectedId={filters.stopId}
          onSelect={setStop}
          testID="explore-stop-filter"
        />
        <ChipDropdown
          label={typeLabel}
          options={typeOptions}
          selectedId={filters.category}
          onSelect={(id) => setCategory(id as FilterId)}
          testID="explore-type-filter"
        />
        <Pressable
          onPress={() => { tap(); onOpenFilters(); }}
          hitSlop={SLIDERS_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Filters"
          testID="explore-sliders-button"
          style={({ pressed }) => [s.sliders, pressed && s.pressed]}
        >
          <SlidersHorizontalIcon size={16} color={t.text} />
          {filterCount > 0 ? (
            <View style={s.badge}>
              <Text style={s.badgeLabel}>{filterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((t) => ({
  container: { paddingHorizontal: Gutter, paddingBottom: Spacing.md },
  title: { ...Typography.roles.screen, color: t.text, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sliders: {
    marginLeft: 'auto',
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: t.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A counter, not `Badge`: that primitive is 20px tall with its own type role, and
  // stretching it to 16 for this one caller would change it for every other consumer.
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: t.action,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: {
    fontSize: 9.5,
    lineHeight: 11,
    fontFamily: 'DMSans-Bold',
    fontWeight: '700' as const,
    color: t.textInverse,
  },
  pressed: { opacity: PRESSED_OPACITY },
}));
