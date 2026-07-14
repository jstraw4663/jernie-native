import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Core, Spacing, Typography } from '@/src/design/tokens';
import { PlaceCarouselCard } from './PlaceCarouselCard';
import type { Place } from '@/src/types';
import type { CarouselRow } from '@/src/domain/explore';

interface PlaceCarouselRowProps {
  row: CarouselRow;
  getStopColor: (place: Place) => string;
  getPhotoUrl: (place: Place) => string | undefined;
  addedPlaceIds: Set<string>;
  onCardPress: (place: Place) => void;
}

export function PlaceCarouselRow({ row, getStopColor, getPhotoUrl, addedPlaceIds, onCardPress }: PlaceCarouselRowProps) {
  return (
    <View style={s.container}>
      <Text style={s.label}>{row.label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {row.places.map(place => (
          <PlaceCarouselCard
            key={place.id}
            place={place}
            photoUrl={getPhotoUrl?.(place)}
            stopColor={getStopColor(place)}
            isAdded={addedPlaceIds.has(place.id)}
            onPress={() => onCardPress(place)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { marginBottom: Spacing.md },
  label:     { ...Typography.roles.h3, color: Core.text, paddingHorizontal: Spacing.base, marginBottom: Spacing.sm },
  scroll:    { paddingHorizontal: Spacing.base, gap: Spacing.sm },
});
