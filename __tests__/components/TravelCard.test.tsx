import React from 'react';
import renderer from 'react-test-renderer';
import { Text } from 'react-native';
import { TravelCard } from '@/src/features/jernie/components/TravelCard';
import type { FlightBooking, RentalBooking } from '@/src/types';

// expo-linear-gradient's real implementation calls into a native color-processing
// path that this project's jest environment can't satisfy — swap it for a plain
// View so the flight variant (the only one that uses it) can render in tests.
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});

function renderCard(ui: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  renderer.act(() => {
    tree = renderer.create(ui);
  });
  return tree;
}

// Flattens each <Text>'s children (which React may pass as an array of literal
// strings/interpolated values rather than one pre-joined string) into the same
// plain string a user would actually see rendered on screen.
function texts(tree: renderer.ReactTestRenderer): string {
  const joined = tree.root.findAllByType(Text).map(t => {
    const children = t.props.children;
    return Array.isArray(children) ? children.join('') : String(children);
  });
  return JSON.stringify(joined);
}

const crossStopRental: RentalBooking = {
  id: 'rental-1',
  tripId: 'trip-1',
  stopId: 'stop-portland',
  type: 'rental',
  company: 'Enterprise',
  carType: 'Compact SUV',
  pickupDate: '2026-07-10',
  dropoffDate: '2026-07-15',
  pickupLocation: 'Portland Jetport',
  dropoffLocation: 'Trenton, ME',
  dropoffStopId: 'stop-bar-harbor',
};

const sameStopRental: RentalBooking = {
  id: 'rental-2',
  tripId: 'trip-1',
  stopId: 'stop-portland',
  type: 'rental',
  company: 'Hertz',
  pickupDate: '2026-07-10',
  dropoffDate: '2026-07-12',
  pickupLocation: 'Portland Jetport',
  dropoffLocation: 'Portland Jetport',
};

const singleLegFlight: FlightBooking = {
  id: 'flight-1',
  tripId: 'trip-1',
  stopId: 'stop-portland',
  type: 'flight',
  legs: [
    { airline: 'JetBlue', flightNumber: 'B6 274', origin: 'BOS', destination: 'PWM', departureDate: '2026-07-10', departureTime: '7:15 AM', arrivalTime: '8:22 AM' },
  ],
};

const multiLegFlight: FlightBooking = {
  ...singleLegFlight,
  id: 'flight-2',
  legs: [
    { airline: 'JetBlue', flightNumber: 'B6 1', origin: 'CLT', destination: 'BWI', departureDate: '2026-07-10', departureTime: '8:20 AM', arrivalTime: '9:50 AM' },
    { airline: 'JetBlue', flightNumber: 'B6 2', origin: 'BWI', destination: 'PWM', departureDate: '2026-07-10', departureTime: '11:00 AM', arrivalTime: '12:30 PM' },
  ],
};

const emptyLegsFlight: FlightBooking = { ...singleLegFlight, id: 'flight-3', legs: [] };

// ── Rental pickup/dropoff badge ───────────────────────────────────────────────

test('rental: shows "Pickup here" badge and pickup location when rendered under the pickup stop', () => {
  const tree = renderCard(
    <TravelCard booking={crossStopRental} stopColor="#000" stopId="stop-portland" />
  );
  expect(texts(tree)).toContain('Pickup here');
  expect(texts(tree)).toContain('Portland Jetport');
  expect(texts(tree)).not.toContain('Drop-off here');
});

test('rental: shows "Drop-off here" badge and dropoff location when rendered under the dropoff stop', () => {
  const tree = renderCard(
    <TravelCard booking={crossStopRental} stopColor="#000" stopId="stop-bar-harbor" />
  );
  expect(texts(tree)).toContain('Drop-off here');
  expect(texts(tree)).toContain('Trenton, ME');
  expect(texts(tree)).not.toContain('Pickup here');
});

test('rental: shows no badge for a same-stop rental (no dropoffStopId)', () => {
  const tree = renderCard(
    <TravelCard booking={sameStopRental} stopColor="#000" stopId="stop-portland" />
  );
  expect(texts(tree)).not.toContain('Pickup here');
  expect(texts(tree)).not.toContain('Drop-off here');
});

test('rental: shows no badge when stopId is not supplied', () => {
  const tree = renderCard(<TravelCard booking={crossStopRental} stopColor="#000" />);
  expect(texts(tree)).not.toContain('Pickup here');
  expect(texts(tree)).not.toContain('Drop-off here');
});

// ── Flight legs ────────────────────────────────────────────────────────────────

test('flight: single-leg booking renders the hero route but no extra per-leg rows', () => {
  const tree = renderCard(<TravelCard booking={singleLegFlight} stopColor="#000" />);
  const t = texts(tree);
  expect(t).toContain('BOS');
  expect(t).toContain('PWM');
  // No standalone "BOS → PWM · ..." leg row duplicating the hero for a single leg.
  expect(t).not.toContain('BOS → PWM');
});

test('flight: multi-leg booking renders the overall hero route (first origin, last destination)', () => {
  const tree = renderCard(<TravelCard booking={multiLegFlight} stopColor="#000" />);
  const t = texts(tree);
  expect(t).toContain('CLT'); // first leg origin
  expect(t).toContain('PWM'); // last leg destination
});

test('flight: multi-leg booking renders each leg as its own row', () => {
  const tree = renderCard(<TravelCard booking={multiLegFlight} stopColor="#000" />);
  const t = texts(tree);
  expect(t).toContain('CLT → BWI · 8:20 AM → 9:50 AM');
  expect(t).toContain('BWI → PWM · 11:00 AM → 12:30 PM');
});

test('flight: empty legs array falls back gracefully instead of crashing', () => {
  const tree = renderCard(<TravelCard booking={emptyLegsFlight} stopColor="#000" />);
  expect(texts(tree)).toContain('—');
});
