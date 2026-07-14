import React from 'react';
import renderer from 'react-test-renderer';
import { Text } from 'react-native';
import { HikeSheet } from '@/src/features/jernie/sheets/HikeSheet';
import type { Place } from '@/src/types';

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});
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

const BEEHIVE: Place = {
  id: 'place-hike-1', tripId: 'trip-1', stopId: 'stop-1', name: 'Beehive Trail',
  category: 'hike', must: true, source: 'curator', addedBy: 'uid-1',
  curatorNote: 'Iron rungs, not for the faint of heart.', distance: '1.6 miles', difficulty: 'strenuous',
};

describe('HikeSheet', () => {
  test('with no place resolved, falls back to the original mock content', () => {
    const tree = renderSheet(<HikeSheet name="Jordan Pond Loop" stopLabel="Bar Harbor" stopColor="#123" onClose={() => {}} />);
    expect(texts(tree)).toContain('Jordan Pond Loop');
    expect(texts(tree)).toContain('crown jewel loop of Acadia');
  });

  test('with a real place, shows real distance/difficulty instead of mock stats', () => {
    const tree = renderSheet(<HikeSheet name="unused" stopLabel="Bar Harbor" stopColor="#123" place={BEEHIVE} onClose={() => {}} />);
    const t = texts(tree);
    expect(t).toContain('Beehive Trail');
    expect(t).toContain('1.6 miles');
    expect(t).toContain('strenuous');
    expect(t).not.toContain('crown jewel loop of Acadia');
  });

  test('omits stat cards entirely for fields the real place lacks (duration)', () => {
    const tree = renderSheet(<HikeSheet name="unused" stopLabel="Bar Harbor" stopColor="#123" place={BEEHIVE} onClose={() => {}} />);
    expect(texts(tree)).not.toContain('Duration');
  });

  test('hides the Address section when neither Place.addr nor enrichment has one', () => {
    const tree = renderSheet(<HikeSheet name="unused" stopLabel="Bar Harbor" stopColor="#123" place={BEEHIVE} onClose={() => {}} />);
    expect(texts(tree)).not.toContain('Contact & Location');
  });

  test('shows the address when Place.addr is present', () => {
    const withAddr: Place = { ...BEEHIVE, addr: 'Sand Beach Parking Area' };
    const tree = renderSheet(<HikeSheet name="unused" stopLabel="Bar Harbor" stopColor="#123" place={withAddr} onClose={() => {}} />);
    expect(texts(tree)).toContain('Sand Beach Parking Area');
  });
});
