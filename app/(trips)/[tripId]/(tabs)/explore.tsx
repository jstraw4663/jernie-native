// Explore — find something worth adding, near where you'll actually be.
//
// Session 7. The screen owns almost nothing now: the filters live in ExploreFilterContext so
// Session 8's Map arrives on the same result set, and the two sections are their own
// components. What is left here is the wiring and the one thing that is genuinely this
// screen's own — what happens when you decide to add a place.
//
// Reference: docs/design/Jernie Screen.dc.html (the `isExplore` block) and
// docs/design/Jernie Spec.dc.html panel 6b.
import { MagnifyingGlassIcon } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import React, { useCallback, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { useTripContext } from '@/src/contexts/TripContext';
import { useExploreFilters } from '@/src/contexts/ExploreFilterContext';
import { createThemedStyles } from '@/src/design/useTheme';
import {
  buildFeaturedPlaces, getAddedPlaceIds, getShuffleSeed, matchesFilters, sortPlaces,
} from '@/src/domain/explore';
import { resolvePlacePhoto } from '@/src/domain/placeEnrichment';
import { ExploreFeaturedRow } from '@/src/features/jernie/explore/ExploreFeaturedRow';
import { ExploreFilterBar } from '@/src/features/jernie/explore/ExploreFilterBar';
import { ExploreFilterSheet } from '@/src/features/jernie/explore/ExploreFilterSheet';
import type { ExploreFilterSheetRef } from '@/src/features/jernie/explore/ExploreFilterSheet';
import { ExploreGrid } from '@/src/features/jernie/explore/ExploreGrid';
import { DayPickerSheet } from '@/src/features/jernie/sheets/DayPickerSheet';
import type { DayPickerSheetRef } from '@/src/features/jernie/sheets/DayPickerSheet';
import { DetailSheet, useDetailSheet } from '@/src/features/jernie/sheets/detail';
import { addPlaceToItinerary } from '@/src/lib/itineraryWrites';
import { PromptRow } from '@/src/ui';
import type { Place } from '@/src/types';

export default function ExploreTab() {
  const { trip, stops, places, itinerary, enrichment, refetch } = useTripContext();
  const { filters, setStop, setCategory, setSearch, setMustOnly, setSort, reset } = useExploreFilters();
  const [s, t] = useStyles();

  const detail = useDetailSheet();
  const dayPickerRef = useRef<DayPickerSheetRef>(null);
  const filterSheetRef = useRef<ExploreFilterSheetRef>(null);

  const shuffleSeed = useMemo(() => getShuffleSeed(Date.now()), []);
  const addedPlaceIds = useMemo(() => getAddedPlaceIds(itinerary), [itinerary]);

  const getPhotoUrl = useCallback(
    (place: Place) => resolvePlacePhoto(place, enrichment),
    [enrichment],
  );

  const matching = useMemo(
    () => places.filter(place => matchesFilters(place, filters)),
    [places, filters],
  );

  const sorted = useMemo(
    () => sortPlaces(matching, enrichment, filters.sort),
    [matching, enrichment, filters.sort],
  );

  const featured = useMemo(
    () => buildFeaturedPlaces(places, filters, shuffleSeed),
    [places, filters, shuffleSeed],
  );

  const stopCity = filters.stopId === 'all'
    ? undefined
    : stops.find(stop => stop.id === filters.stopId)?.city;

  const handlePlacePress = useCallback((place: Place) => {
    detail.openPlace(place, {
      isAdded: addedPlaceIds.has(place.id),
      // The picker rather than the stop's first day: auto-picking silently did nothing when
      // the stop had no days, which made the empty case invisible.
      onAdd: () => {
        detail.dismiss();
        // The place's own stop, not the filter's — a place found under "All stops" belongs
        // where it is, not where you happened to be browsing.
        dayPickerRef.current?.present({
          stopId: place.stopId,
          onPick: day => {
            addPlaceToItinerary(trip.id, place, day).then(refetch).catch(console.error);
          },
        });
      },
    });
  }, [detail, addedPlaceIds, trip.id, refetch]);

  const handleApplySheet = useCallback(
    (next: { search: string; mustOnly: boolean }) => {
      setSearch(next.search);
      setMustOnly(next.mustOnly);
    },
    [setSearch, setMustOnly],
  );

  return (
    <View style={s.screen}>
      <ExploreFilterBar
        stops={stops}
        filters={filters}
        setStop={setStop}
        setCategory={setCategory}
        onOpenFilters={() => filterSheetRef.current?.present()}
      />

      <ExploreGrid
        places={sorted}
        sort={filters.sort}
        onSortChange={setSort}
        getPhotoUrl={getPhotoUrl}
        addedPlaceIds={addedPlaceIds}
        onPlacePress={handlePlacePress}
        header={
          <ExploreFeaturedRow
            places={featured}
            nearbyCount={sorted.length}
            stopCity={stopCity}
            getPhotoUrl={getPhotoUrl}
            addedPlaceIds={addedPlaceIds}
            onPlacePress={handlePlacePress}
          />
        }
        // An empty state is an action, not a centred grey sentence. It names what is
        // filtering the list away and offers the way out.
        empty={
          <PromptRow
            testID="explore-empty"
            title="No places match these filters"
            sub="Widen the stop or the type, or clear them and start again"
            action="Clear"
            icon={<MagnifyingGlassIcon size={18} color={t.textMuted} weight="regular" />}
            onPress={reset}
          />
        }
      />

      <ExploreFilterSheet
        ref={filterSheetRef}
        search={filters.search}
        mustOnly={filters.mustOnly}
        onApply={handleApplySheet}
      />
      <DetailSheet ref={detail.sheet} />
      <DayPickerSheet ref={dayPickerRef} />
    </View>
  );
}

const useStyles = createThemedStyles(t => ({
  screen: { flex: 1, backgroundColor: t.surface },
}));
