import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Core, Spacing, Radius, Typography } from '@/src/design/tokens';
import { PlaceListCard } from './PlaceListCard';
import { SORT_OPTIONS } from '@/src/domain/explore';
import type { SortKey } from '@/src/domain/explore';
import type { Place } from '@/src/types';

interface PlaceListProps {
  places: Place[]; // caller applies sortPlaces() before passing these in
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  accentColor: string;   // used for the sort-pill selection state only
  getStopColor: (place: Place) => string;
  addedPlaceIds: Set<string>;
  onPlacePress: (place: Place) => void;
}

export function PlaceList({ places, sort, onSortChange, accentColor, getStopColor, addedPlaceIds, onPlacePress }: PlaceListProps) {
  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>All Places <Text style={s.count}>{places.length}</Text></Text>
      </View>

      <View style={s.sortRow}>
        {SORT_OPTIONS.map(opt => {
          const active = opt.value === sort;
          return (
            <Text
              key={opt.value}
              testID={`sort-${opt.value}`}
              onPress={() => onSortChange(opt.value)}
              style={[s.sortPill, active && { backgroundColor: accentColor, color: Core.white, borderColor: accentColor }]}
            >
              {opt.label}
            </Text>
          );
        })}
      </View>

      {places.length === 0 ? (
        <Text style={s.empty}>No places match this filter.</Text>
      ) : (
        places.map(place => (
          <PlaceListCard
            key={place.id}
            place={place}
            stopColor={getStopColor(place)}
            isAdded={addedPlaceIds.has(place.id)}
            onPress={() => onPlacePress(place)}
          />
        ))
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { paddingHorizontal: Spacing.base, paddingTop: Spacing.md, paddingBottom: Spacing.xxl },
  header:    { marginBottom: Spacing.sm },
  title:     { ...Typography.roles.h3, color: Core.text },
  count:     { ...Typography.roles.meta, color: Core.textMuted },
  sortRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.md },
  sortPill:  { ...Typography.roles.label, color: Core.textMuted, borderWidth: 1, borderColor: Core.border, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 6, overflow: 'hidden' },
  empty:     { ...Typography.roles.body, color: Core.textMuted, textAlign: 'center', paddingVertical: Spacing.xl },
});
