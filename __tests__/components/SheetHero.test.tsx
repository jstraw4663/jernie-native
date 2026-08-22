import { ForkKnifeIcon } from 'phosphor-react-native/src/icons/ForkKnife';
import React from 'react';
import renderer from 'react-test-renderer';
import { Image } from 'react-native';
import { SheetHero } from '@/src/features/jernie/sheets/SheetHero';

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});

function renderHero(ui: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  renderer.act(() => { tree = renderer.create(ui); });
  return tree;
}

describe('SheetHero', () => {
  test('place mode with a photoUri renders an Image', () => {
    const tree = renderHero(
      <SheetHero mode="place" photoUri="https://example.com/photo.jpg" Glyph={ForkKnifeIcon} categoryLabel="Restaurant" stopLabel="Portland" stopColor="#123" onClose={() => {}} />,
    );
    const images = tree.root.findAllByType(Image);
    expect(images.some(img => img.props.source?.uri === 'https://example.com/photo.jpg')).toBe(true);
  });

  test('place mode with no photoUri falls back to the gradient — no Image at all (regression: this used to always render an Image)', () => {
    const tree = renderHero(
      <SheetHero mode="place" Glyph={ForkKnifeIcon} categoryLabel="Restaurant" stopLabel="Portland" stopColor="#123" onClose={() => {}} />,
    );
    expect(tree.root.findAllByType(Image)).toHaveLength(0);
  });

  test('travel mode with a photoUri renders an Image', () => {
    const tree = renderHero(
      <SheetHero mode="travel" photoUri="https://example.com/hotel.jpg" stopColor="#123" onClose={() => {}}>
        <></>
      </SheetHero>,
    );
    const images = tree.root.findAllByType(Image);
    expect(images.some(img => img.props.source?.uri === 'https://example.com/hotel.jpg')).toBe(true);
  });

  test('travel mode with no photoUri falls back to the gradient — no Image', () => {
    const tree = renderHero(
      <SheetHero mode="travel" stopColor="#123" onClose={() => {}}>
        <></>
      </SheetHero>,
    );
    expect(tree.root.findAllByType(Image)).toHaveLength(0);
  });
});
