import React, { useState, useRef, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTripContext } from '@/src/contexts/TripContext';
import {
  getShuffleSeed, buildCarouselRows, matchesCategoryFilter, matchesStopFilter, matchesSearch,
  sortPlaces, getAddedPlaceIds,
} from '@/src/domain/explore';
import type { FilterId, SortKey } from '@/src/domain/explore';
import { addPlaceToItinerary } from '@/src/lib/itineraryWrites';
import { getPlaceEnrichment, resolvePlacePhoto } from '@/src/domain/placeEnrichment';
import { SearchBar } from '@/src/features/jernie/explore/SearchBar';
import { FilterPillRow } from '@/src/features/jernie/explore/FilterPillRow';
import { PlaceCarouselRow } from '@/src/features/jernie/explore/PlaceCarouselRow';
import { PlaceList } from '@/src/features/jernie/explore/PlaceList';
import { EntityDetailSheet } from '@/src/features/jernie/sheets/EntityDetailSheet';
import type { EntityDetailSheetRef } from '@/src/features/jernie/sheets/EntityDetailSheet';
import { DayPickerSheet } from '@/src/features/jernie/sheets/DayPickerSheet';
import type { DayPickerSheetRef } from '@/src/features/jernie/sheets/DayPickerSheet';
import { Core, Spacing, Typography } from '@/src/design/tokens';
import type { Place } from '@/src/types';

const CATEGORY_FILTER_ITEMS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'restaurant', label: 'Eats' },
  { id: 'hike', label: 'Hikes' },
  { id: 'bar', label: 'Bars' },
  { id: 'sights', label: 'Sights & More' },
  { id: 'activity', label: 'Activities' },
];

export default function ExploreTab() {
  const { trip, stops, places, itinerary, enrichment, refetch } = useTripContext();
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const [activeStopId, setActiveStopId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('rating');
  const entitySheetRef = useRef<EntityDetailSheetRef>(null);
  const dayPickerRef = useRef<DayPickerSheetRef>(null);

  const shuffleSeed = useMemo(() => getShuffleSeed(Date.now()), []);
  const addedPlaceIds = useMemo(() => getAddedPlaceIds(itinerary), [itinerary]);

  const getStopColor = useCallback(
    (place: Place) => stops.find(s => s.id === place.stopId)?.color ?? Core.action,
    [stops],
  );

  const getPhotoUrl = useCallback(
    (place: Place) => resolvePlacePhoto(place, enrichment),
    [enrichment],
  );

  const filteredPlaces = useMemo(
    () => places.filter(p =>
      matchesCategoryFilter(p, activeFilter) &&
      matchesStopFilter(p, activeStopId) &&
      matchesSearch(p, searchQuery),
    ),
    [places, activeFilter, activeStopId, searchQuery],
  );

  const sortedPlaces = useMemo(
    () => sortPlaces(filteredPlaces, enrichment, sort),
    [filteredPlaces, enrichment, sort],
  );

  const carouselRows = useMemo(
    () => buildCarouselRows(places, shuffleSeed, activeFilter, activeStopId).filter(row => row.places.length >= 2),
    [places, shuffleSeed, activeFilter, activeStopId],
  );

  const isSearching = searchQuery.trim().length > 0;

  const handlePlacePress = useCallback((place: Place) => {
    const stop = stops.find(s => s.id === place.stopId);
    entitySheetRef.current?.present({
      kind: place.category === 'hike' ? 'hike' : 'place',
      name: place.name,
      stopLabel: stop?.city ?? '',
      stopColor: stop?.color ?? Core.action,
      place,
      enrichment: getPlaceEnrichment(enrichment, place),
      isAdded: addedPlaceIds.has(place.id),
      // Previously this auto-picked the stop's first day and silently did nothing when the
      // stop had none. The picker gives the user the choice and makes the empty case visible.
      onAdd: () => {
        entitySheetRef.current?.dismiss();
        dayPickerRef.current?.present({
          stopId: place.stopId,
          onPick: day => {
            addPlaceToItinerary(trip.id, place, day).then(refetch).catch(console.error);
          },
        });
      },
    });
  }, [stops, enrichment, addedPlaceIds, trip.id, refetch]);

  const stopFilterItems = useMemo(() => [
    { id: 'all', label: 'All Stops' },
    ...stops.map(s => ({ id: s.id, label: s.city, emoji: s.emoji, color: s.color })),
  ], [stops]);

  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { paddingTop: insets.top + Spacing.sm }]}>Explore</Text>
      <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
      <FilterPillRow items={CATEGORY_FILTER_ITEMS} activeId={activeFilter} onSelect={id => setActiveFilter(id as FilterId)} defaultColor={Core.action} />
      {stops.length > 1 && (
        <FilterPillRow items={stopFilterItems} activeId={activeStopId} onSelect={setActiveStopId} defaultColor={Core.action} />
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {!isSearching && carouselRows.map(row => (
          <PlaceCarouselRow
            key={row.id}
            row={row}
            getStopColor={getStopColor}
            getPhotoUrl={getPhotoUrl}
            addedPlaceIds={addedPlaceIds}
            onCardPress={handlePlacePress}
          />
        ))}

        <PlaceList
          places={sortedPlaces}
          sort={sort}
          onSortChange={setSort}
          accentColor={Core.action}
          getStopColor={getStopColor}
          addedPlaceIds={addedPlaceIds}
          onPlacePress={handlePlacePress}
        />
      </ScrollView>

      <EntityDetailSheet ref={entitySheetRef} />
      <DayPickerSheet ref={dayPickerRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Core.bg },
  title: { ...Typography.roles.display, color: Core.text, paddingHorizontal: Spacing.base, marginBottom: Spacing.sm },
  scrollContent: { paddingBottom: Spacing.xxxl },
});
