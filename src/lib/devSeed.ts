import { createMMKV } from 'react-native-mmkv';
import { database, authReady } from './firebase';
import type { Booking, ItineraryDay } from '@/src/types';

// Runs once per device in __DEV__ builds. Writes the Maine Summer 2026 trip to RTDB
// using the anonymous auth UID as ownerUid so RTDB rules pass on subsequent reads.

const seedStorage = createMMKV({ id: 'jernie-seed' });
const SEED_KEY = 'seeded_v2_dev_trip_001';

export async function maybeSeedDevData(): Promise<void> {
  if (!__DEV__) return;
  if (seedStorage.getBoolean(SEED_KEY)) return;

  const user = await authReady;

  const stops = {
    'stop-portland': {
      id: 'stop-portland',
      tripId: 'dev-trip-001',
      city: 'Portland',
      region: 'ME',
      emoji: '🦞',
      lat: 43.6615,
      lon: -70.2553,
      dates: { start: '2026-07-10', end: '2026-07-12' },
      order: 0,
    },
    'stop-bar-harbor': {
      id: 'stop-bar-harbor',
      tripId: 'dev-trip-001',
      city: 'Bar Harbor',
      region: 'ME',
      emoji: '⛵',
      lat: 44.3876,
      lon: -68.2039,
      dates: { start: '2026-07-12', end: '2026-07-15' },
      order: 1,
    },
  };

  const bookings: Record<string, Booking> = {
    'booking-flight-1': {
      id: 'booking-flight-1',
      tripId: 'dev-trip-001',
      stopId: 'stop-portland',
      type: 'flight',
      legs: [
        {
          airline: 'JetBlue',
          flightNumber: 'B6 274',
          origin: 'BOS',
          destination: 'PWM',
          departureDate: '2026-07-10',
          departureTime: '7:15 AM',
          arrivalTime: '8:22 AM',
        },
      ],
      confirmationCode: 'JBLMNE',
    },
    'booking-hotel-portland': {
      id: 'booking-hotel-portland',
      tripId: 'dev-trip-001',
      stopId: 'stop-portland',
      type: 'hotel',
      hotelName: 'Press Hotel',
      checkIn: '2026-07-10',
      checkOut: '2026-07-12',
      confirmationCode: 'PHR2026',
      address: '119 Exchange St, Portland, ME 04101',
    },
    'booking-rental-1': {
      id: 'booking-rental-1',
      tripId: 'dev-trip-001',
      stopId: 'stop-portland',
      type: 'rental',
      company: 'Enterprise',
      carType: 'Compact SUV',
      pickupDate: '2026-07-10',
      pickupTime: '9:00 AM',
      dropoffDate: '2026-07-15',
      dropoffTime: '2:00 PM',
      pickupLocation: 'Portland Jetport',
      dropoffLocation: 'Trenton, ME',
      dropoffStopId: 'stop-bar-harbor',
    },
    'booking-hotel-bar-harbor': {
      id: 'booking-hotel-bar-harbor',
      tripId: 'dev-trip-001',
      stopId: 'stop-bar-harbor',
      type: 'hotel',
      hotelName: 'Bar Harbor Inn',
      checkIn: '2026-07-12',
      checkOut: '2026-07-15',
      address: '1 Newport Dr, Bar Harbor, ME 04609',
    },
    'booking-restaurant-eventide': {
      id: 'booking-restaurant-eventide',
      tripId: 'dev-trip-001',
      stopId: 'stop-portland',
      type: 'restaurant',
      restaurantName: 'Eventide Oyster Co.',
      date: '2026-07-11',
      time: '6:00 PM',
      partySize: 2,
      confirmationCode: 'EVT2607',
    },
    'booking-restaurant-geddys': {
      id: 'booking-restaurant-geddys',
      tripId: 'dev-trip-001',
      stopId: 'stop-bar-harbor',
      type: 'restaurant',
      restaurantName: "Geddy's",
      date: '2026-07-12',
      time: '7:00 PM',
      partySize: 2,
    },
    'booking-restaurant-jordan-pond': {
      id: 'booking-restaurant-jordan-pond',
      tripId: 'dev-trip-001',
      stopId: 'stop-bar-harbor',
      type: 'restaurant',
      restaurantName: 'Jordan Pond House',
      date: '2026-07-13',
      time: '12:30 PM',
      partySize: 2,
      confirmationCode: 'JPH1307',
    },
  };

  const itineraryDays: Record<string, Record<string, ItineraryDay>> = {
    'stop-portland': {
      'day-pdx-1': {
        id: 'day-pdx-1',
        stopId: 'stop-portland',
        dateIso: '2026-07-10',
        items: [
          { id: 'i-pdx-1-1', type: 'booking', bookingId: 'booking-flight-1',  label: 'Arrive PWM · Pick up rental car', time: '8:22 AM',  category: 'flight',     order: 0 },
          { id: 'i-pdx-1-2', type: 'custom',  label: 'Duckfat — lunch',                                                  time: '12:00 PM', category: 'restaurant', order: 1 },
          { id: 'i-pdx-1-3', type: 'custom',  label: 'Portland Head Light',                                               time: '3:00 PM',  category: 'sight',      order: 2 },
          { id: 'i-pdx-1-4', type: 'custom',  label: 'Fore Street — dinner',                                              time: '7:00 PM',  category: 'restaurant', order: 3 },
        ],
      },
      'day-pdx-2': {
        id: 'day-pdx-2',
        stopId: 'stop-portland',
        dateIso: '2026-07-11',
        items: [
          { id: 'i-pdx-2-1', type: 'custom',  label: 'Maine Narrow Gauge Railroad',                                       time: '10:00 AM', category: 'activity',   order: 0 },
          { id: 'i-pdx-2-2', type: 'custom',  label: 'Portland Museum of Art',                                            time: '2:00 PM',  category: 'activity',   order: 1 },
          { id: 'i-pdx-2-3', type: 'booking', bookingId: 'booking-restaurant-eventide', label: 'Eventide Oyster Co.',      time: '6:00 PM',  category: 'restaurant', order: 2 },
        ],
      },
    },
    'stop-bar-harbor': {
      'day-bh-1': {
        id: 'day-bh-1',
        stopId: 'stop-bar-harbor',
        dateIso: '2026-07-12',
        items: [
          { id: 'i-bh-1-1', type: 'custom',  label: 'Drive to Bar Harbor (2.5 hrs)',                             time: '9:00 AM',  category: 'transport',  order: 0 },
          { id: 'i-bh-1-2', type: 'custom',  label: 'Check in · Bar Harbor Inn',                                 time: '3:00 PM',  category: 'custom',     order: 1 },
          { id: 'i-bh-1-3', type: 'booking', bookingId: 'booking-restaurant-geddys', label: "Geddy's — dinner",  time: '7:00 PM',  category: 'restaurant', order: 2 },
        ],
      },
      'day-bh-2': {
        id: 'day-bh-2',
        stopId: 'stop-bar-harbor',
        dateIso: '2026-07-13',
        items: [
          { id: 'i-bh-2-1', type: 'custom',  label: 'Acadia National Park hike',                                                time: '8:00 AM',   category: 'hike',       order: 0, groupIds: ['group-guys-hike'] },
          { id: 'i-bh-2-2', type: 'booking', bookingId: 'booking-restaurant-jordan-pond', label: 'Jordan Pond House — lunch',  time: '12:30 PM',  category: 'restaurant', order: 1 },
          { id: 'i-bh-2-3', type: 'custom',  label: 'Cadillac Mountain sunset',                                                 time: '7:30 PM',   category: 'sight',      order: 2 },
        ],
      },
      'day-bh-3': {
        id: 'day-bh-3',
        stopId: 'stop-bar-harbor',
        dateIso: '2026-07-14',
        items: [
          { id: 'i-bh-3-1', type: 'custom',  label: 'Trailhead Cafe — breakfast',   time: '8:00 AM',  category: 'restaurant', order: 0 },
          { id: 'i-bh-3-2', type: 'custom',  label: 'Morning kayak tour',           time: '10:00 AM', category: 'activity',   order: 1 },
          { id: 'i-bh-3-3', type: 'custom',  label: 'Thunder Hole walk',            time: '1:00 PM',  category: 'sight',      order: 2 },
          { id: 'i-bh-3-4', type: 'booking', bookingId: 'booking-rental-1', label: 'Drop off rental · Trenton, ME', time: '2:00 PM', category: 'transport', order: 3 },
          { id: 'i-bh-3-5', type: 'custom',  label: 'Café This Way — dinner',       time: '6:30 PM',  category: 'restaurant', order: 4 },
        ],
      },
    },
  };

  const tripData = {
    id: 'dev-trip-001',
    name: 'Maine Summer 2026',
    ownerUid: user.uid,
    createdAt: 1748476800000,  // 2026-05-29 00:00:00 UTC
    pills: ['Adventure', 'Food-forward'],
    inviteToken: 'abc123',
    colorPack: {
      id: 'coastal',
      stopColors: ['#2C5880', '#2F6B47'],
      heroGradient: ['#0D2B3E', '#2C5880'],
    },
    setupIntent: { flights: true, stays: true, car: true, restaurants: true },
    stops,
    bookings,
    itinerary: itineraryDays,
    confirms: {},
    groups: {
      'group-guys-hike': {
        id: 'group-guys-hike',
        tripId: 'dev-trip-001',
        name: "Guys' hike day",
        memberUids: [user.uid],
        createdBy: user.uid,
        createdAt: 1748476800000,  // 2026-05-29 00:00:00 UTC
      },
    },
  };

  // Step 1: create the trip as a standalone write. RTDB rules require the trip's
  // ownerUid to already be committed before anything that reads it (members,
  // users index, inviteTokens) can be written — see the two-step protocol
  // established in Task 1 (database.rules.json) and empirically verified against
  // the RTDB emulator: a sibling path bundled into the *same* multi-location
  // update() call only sees the pre-update state, not this trip's new ownerUid.
  //
  // Guard against a partial prior run: if step 1 succeeded on an earlier launch
  // but step 2 then failed (killed app, flaky dev network, etc.), SEED_KEY never
  // got set, so we're re-entering this function — but the trips/dev-trip-001
  // rule is `!data.exists() && ...`, so re-running .set() on a node that already
  // exists is permission-denied forever. Check first, and skip straight to step 2
  // (whose writes are all idempotent keyed writes, not dependent on step 1 having
  // just run in this same invocation) if the trip is already there.
  const tripSnapshot = await database().ref('trips/dev-trip-001').once('value');
  if (!tripSnapshot.exists()) {
    await database().ref('trips/dev-trip-001').set(tripData);
  }

  // Step 2: only after step 1 resolves, bundle the owner's membership record,
  // the denormalized users/{uid}/trips read index, and the invite token lookup
  // into a single update(). This is safe to bundle because none of these three
  // paths is the trip object itself — they all just need the trip's ownerUid to
  // already be committed, which step 1 guaranteed.
  const joinedAt = 1748476800000;  // same instant as trip creation, for this fixture
  await database().ref().update({
    ['trips/dev-trip-001/members/' + user.uid]: {
      uid: user.uid,
      handle: 'Jeremy',
      role: 'organizer',
      joinedAt,
    },
    ['users/' + user.uid + '/trips/dev-trip-001']: { role: 'organizer', joinedAt },
    'inviteTokens/abc123': 'dev-trip-001',
  });

  seedStorage.set(SEED_KEY, true);
  console.log('[devSeed] Seeded dev-trip-001 as uid:', user.uid);
}
