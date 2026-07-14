import React from 'react';
import renderer from 'react-test-renderer';
import { Text } from 'react-native';
import { PlaceSheet } from '@/src/features/jernie/sheets/PlaceSheet';
import type { Place, PlaceEnrichment } from '@/src/types';

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});

// @gorhom/bottom-sheet's real import chain needs reanimated UI-thread APIs this
// project's jest mock doesn't provide — swap BottomSheetScrollView for a plain ScrollView.
jest.mock('@gorhom/bottom-sheet', () => {
  const { ScrollView } = require('react-native');
  return { BottomSheetScrollView: ScrollView };
});

function renderSheet(ui: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  renderer.act(() => { tree = renderer.create(ui); });
  return tree;
}

function texts(tree: renderer.ReactTestRenderer): string {
  return tree.root.findAllByType(Text).map(t => {
    const children = t.props.children;
    return Array.isArray(children) ? children.join('') : String(children);
  }).join(' | ');
}

const RESTAURANT: Place = {
  id: 'place-1', tripId: 'trip-1', stopId: 'stop-1', name: 'Eventide Oyster Co.',
  category: 'restaurant', must: true, source: 'curator', addedBy: 'uid-1',
  curatorNote: 'Brown butter lobster roll is unmissable.', rating: 4.7, price: '$$$',
  subcategory: 'seafood',
};

const SIGHT_NO_EXTRAS: Place = {
  id: 'place-2', tripId: 'trip-1', stopId: 'stop-1', name: 'Portland Head Light',
  category: 'sight', must: false, source: 'curator', addedBy: 'uid-1',
};

describe('PlaceSheet', () => {
  test('with no place resolved, falls back to the original mock content', () => {
    const tree = renderSheet(<PlaceSheet name="Some Restaurant" stopLabel="Portland" stopColor="#123" onClose={() => {}} />);
    expect(texts(tree)).toContain('Some Restaurant');
    expect(texts(tree)).toContain('Latin-influenced coastal cuisine');
  });

  test('with a real place, shows that place\'s own name and curatorNote', () => {
    const tree = renderSheet(<PlaceSheet name="unused" stopLabel="Portland" stopColor="#123" place={RESTAURANT} onClose={() => {}} />);
    const t = texts(tree);
    expect(t).toContain('Eventide Oyster Co.');
    expect(t).toContain('Brown butter lobster roll is unmissable.');
    expect(t).not.toContain('Latin-influenced coastal cuisine'); // no mock leakage
  });

  test('two different real places render visibly different content', () => {
    const treeA = renderSheet(<PlaceSheet name="unused" stopLabel="Portland" stopColor="#123" place={RESTAURANT} onClose={() => {}} />);
    const treeB = renderSheet(<PlaceSheet name="unused" stopLabel="Portland" stopColor="#123" place={SIGHT_NO_EXTRAS} onClose={() => {}} />);
    expect(texts(treeA)).not.toEqual(texts(treeB));
    expect(texts(treeB)).toContain('Portland Head Light');
  });

  test('hides Photos/Reviews/Contact sections entirely when neither Place nor enrichment has that data', () => {
    const tree = renderSheet(<PlaceSheet name="unused" stopLabel="Portland" stopColor="#123" place={SIGHT_NO_EXTRAS} onClose={() => {}} />);
    const t = texts(tree);
    expect(t).not.toContain('Photos');
    expect(t).not.toContain('Reviews');
    expect(t).not.toContain('Contact & Location');
  });

  test('shows real enrichment fields (reviews, hours, phone) when present', () => {
    const enrichment: PlaceEnrichment = {
      name: 'Eventide Oyster Co.', lat: 43.6, lon: -70.2, cached_at: 1, place_id_locked: true,
      phone: '(207) 555-0100', hours: ['Mon-Sun 11am-9pm'], photos: ['https://example.com/photo.jpg'],
      reviews: [{ author: 'Alex', rating: 5, text: 'So good!', time: 1000 }],
    };
    const tree = renderSheet(<PlaceSheet name="unused" stopLabel="Portland" stopColor="#123" place={RESTAURANT} enrichment={enrichment} onClose={() => {}} />);
    const t = texts(tree);
    expect(t).toContain('Mon-Sun 11am-9pm');
    expect(t).toContain('Alex');
    expect(t).toContain('So good!');
  });

  test('a category with no dedicated meta (activity) still renders using the generic fallback label', () => {
    const activity: Place = { ...SIGHT_NO_EXTRAS, id: 'place-3', name: 'Kayak Tour', category: 'activity' };
    const tree = renderSheet(<PlaceSheet name="unused" stopLabel="Portland" stopColor="#123" place={activity} onClose={() => {}} />);
    expect(texts(tree)).toContain('Kayak Tour');
  });
});
