import React from 'react';
import renderer from 'react-test-renderer';
import { Text, Image } from 'react-native';
import { PlaceCarouselRow } from '@/src/features/jernie/explore/PlaceCarouselRow';
import type { Place } from '@/src/types';
import type { CarouselRow } from '@/src/domain/explore';

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});

function renderRow(ui: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  renderer.act(() => { tree = renderer.create(ui); });
  return tree;
}

const PLACE_A: Place = { id: 'p1', tripId: 't1', stopId: 's1', name: 'Eventide', category: 'restaurant', must: true, source: 'curator', addedBy: 'u1', rating: 4.7, price: '$$$', photoUrl: 'https://example.com/a.jpg' };
const PLACE_B: Place = { id: 'p2', tripId: 't1', stopId: 's1', name: 'Beehive Trail', category: 'hike', must: true, source: 'curator', addedBy: 'u1' };

const ROW: CarouselRow = { id: 'must-do', label: 'Must Do', places: [PLACE_A, PLACE_B] };

const getPhotoUrl = (place: Place) => place.photoUrl;

describe('PlaceCarouselRow / PlaceCarouselCard', () => {
  test('renders the row label and one card per place', () => {
    const tree = renderRow(<PlaceCarouselRow row={ROW} getStopColor={() => "#123"} getPhotoUrl={getPhotoUrl} addedPlaceIds={new Set()} onCardPress={() => {}} />);
    const texts = tree.root.findAllByType(Text).map(t => t.props.children);
    expect(texts).toContain('Must Do');
    expect(texts).toContain('Eventide');
    expect(texts).toContain('Beehive Trail');
  });

  test('a place with a resolved photo renders an Image; one without falls back to no Image for that card', () => {
    const tree = renderRow(<PlaceCarouselRow row={ROW} getStopColor={() => "#123"} getPhotoUrl={getPhotoUrl} addedPlaceIds={new Set()} onCardPress={() => {}} />);
    const images = tree.root.findAllByType(Image);
    expect(images.some(img => img.props.source?.uri === 'https://example.com/a.jpg')).toBe(true);
  });

  test('uses getPhotoUrl to resolve the image, not the place.photoUrl field directly — e.g. Firestore-enrichment-only photos', () => {
    const tree = renderRow(<PlaceCarouselRow row={ROW} getStopColor={() => "#123"} getPhotoUrl={() => 'https://example.com/from-enrichment.jpg'} addedPlaceIds={new Set()} onCardPress={() => {}} />);
    const images = tree.root.findAllByType(Image);
    expect(images.every(img => img.props.source?.uri === 'https://example.com/from-enrichment.jpg')).toBe(true);
  });

  test('shows an Added badge only for places already in the itinerary', () => {
    const tree = renderRow(<PlaceCarouselRow row={ROW} getStopColor={() => "#123"} getPhotoUrl={getPhotoUrl} addedPlaceIds={new Set(['p1'])} onCardPress={() => {}} />);
    const texts = tree.root.findAllByType(Text).map(t => t.props.children);
    expect(texts).toContain('Added');
  });

  test('pressing a card calls onCardPress with that place', () => {
    const onCardPress = jest.fn();
    const tree = renderRow(<PlaceCarouselRow row={ROW} getStopColor={() => "#123"} getPhotoUrl={getPhotoUrl} addedPlaceIds={new Set()} onCardPress={onCardPress} />);
    const touchables = tree.root.findAllByProps({ activeOpacity: 0.85 });
    renderer.act(() => { touchables[0].props.onPress(); });
    expect(onCardPress).toHaveBeenCalledWith(PLACE_A);
  });
});
