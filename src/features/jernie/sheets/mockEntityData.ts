// Mirrors PlaceEnrichment shape from src/types.ts
export const MOCK_RESTAURANT = {
  rating: 4.6,
  ratingCount: 847,
  price: 2,
  phone: '(207) 288-2822',
  website: 'havanarestaurant.com',
  address: '318 Main St, Bar Harbor, ME',
  openNow: true,
  closesAt: '9:30 PM',
  curatorNote: 'Latin-influenced coastal cuisine near the village green. The Caribbean lobster dish is a local staple.',
  guideNote: 'Book 10+ days ahead for weekend tables. Request the courtyard if weather looks good.',
  headsUp: 'No walk-ins for dinner July–August.',
  heroPhoto: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=800&q=80',
  photos: [
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=400&q=75',
    'https://images.unsplash.com/photo-1544025162-d76538d04b8a?auto=format&fit=crop&w=400&q=75',
    'https://images.unsplash.com/photo-1481833761820-0509d3217039?auto=format&fit=crop&w=400&q=75',
    'https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=400&q=75',
  ],
  reviews: [
    { author: 'Meg L.',    rating: 5, text: 'Incredible meal. The ropa vieja was perfectly spiced and the rum cocktails were dangerous. Book ahead — this fills up fast.', time: Date.now() - 1_814_400_000 },
    { author: 'Thomas R.', rating: 4, text: 'Great atmosphere and killer cocktails. Service was a bit slow on a Friday night but the food absolutely made up for it.', time: Date.now() - 2_592_000_000 },
    { author: 'Sarah K.',  rating: 5, text: 'Best dinner of the whole Maine trip. The courtyard is magical when the weather cooperates.', time: Date.now() - 5_184_000_000 },
  ],
  distanceLabel: 'From Jordan Pond trailhead',
  distanceValue: '8.4 mi',
} as const;

// Mirrors TrailEnrichment shape from src/types.ts
export const MOCK_HIKE = {
  distance: 3.4,
  elevationGain: 180,
  difficulty: 'Easy',
  routeType: 'Loop',
  dogFriendly: true,
  curatorNote: 'The crown jewel loop of Acadia — flat 3.4-mile trail around Jordan Pond with dramatic views of The Bubbles.',
  guideNote: 'Parking fills by 10:30 AM in peak season. Take the Island Explorer bus from downtown Bar Harbor (free, runs seasonally).',
  headsUp: 'Popover lunch often has a wait; arrive before noon.',
  address: 'Jordan Pond Rd, Seal Harbor, ME',
  heroPhoto: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Acadia_National_Park_02.JPG/1280px-Acadia_National_Park_02.JPG',
  photos: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Acadia_National_Park_02.JPG/1280px-Acadia_National_Park_02.JPG',
    'https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=400&q=75',
    'https://images.unsplash.com/photo-1533240332313-0db49b459ad6?auto=format&fit=crop&w=400&q=75',
  ],
  distanceLabel: 'From Bar Harbor Grand Hotel',
  distanceValue: '8.7 mi · 22 min',
} as const;

// Mirrors HotelEnrichment shape from src/types.ts
export const MOCK_HOTEL = {
  rating: 4.5,
  ratingCount: 1240,
  phone: '(207) 288-5226',
  website: 'barharborgrand.com',
  address: '269 Main St, Bar Harbor, ME',
  amenities: ['Pool', 'Fitness', 'Free Parking', 'Pet-Friendly', 'Breakfast', 'Concierge'],
  heroPhoto: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=800&q=80',
  distanceLabel: 'From Jordan Pond trailhead',
  distanceValue: '8.7 mi',
} as const;

// Mirrors FlightStatus shape from src/types.ts
export const MOCK_FLIGHT = {
  status: 'on_time' as 'on_time' | 'delayed' | 'cancelled' | 'landed' | 'unknown',
  gate_origin: 'B14',
  terminal_origin: 'B',
  terminal_destination: '1',
  aircraft_type: 'B737-700',
  delay_minutes: 0,
  leaveByLabel: 'By 7:10 AM · allow 90 min',
  afterLanding: {
    rentalLabel: 'Enterprise · Bangor Airport · Compact SUV',
    driveLabel: '42 min · 47 miles · arrive ~11:40 AM',
    distanceLabel: 'Bangor Airport to Bar Harbor Grand',
    distanceValue: '47 mi · 42 min',
  },
} as const;
