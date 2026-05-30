import type { Trip, Stop, Booking, ItineraryDay } from '@/src/types';

export const DEV_TRIP: Trip = {
  id: 'dev-trip-001',
  name: 'Maine Summer 2026',
  ownerUid: 'dev-uid',
  createdAt: Date.now(),
  pills: ['Adventure', 'Food-forward'],
  inviteToken: 'abc123',
  colorPack: {
    id: 'coastal',
    stopColors: ['#2C5880', '#2F6B47'],
    heroGradient: ['#0D2B3E', '#2C5880'],
  },
  setupIntent: { flights: true, stays: true, car: false, restaurants: false },
};

export const DEV_STOPS: Stop[] = [
  {
    id: 'stop-portland',
    tripId: 'dev-trip-001',
    city: 'Portland',
    region: 'ME',
    emoji: '🦞',
    lat: 43.6615,
    lon: -70.2553,
    dates: { start: '2026-07-10', end: '2026-07-12' },
    color: '#2C5880',
    order: 0,
  },
  {
    id: 'stop-bar-harbor',
    tripId: 'dev-trip-001',
    city: 'Bar Harbor',
    region: 'ME',
    emoji: '⛵',
    lat: 44.3876,
    lon: -68.2039,
    dates: { start: '2026-07-12', end: '2026-07-15' },
    color: '#2F6B47',
    order: 1,
  },
];

export const DEV_BOOKINGS: Booking[] = [
  {
    id: 'booking-flight-1',
    tripId: 'dev-trip-001',
    stopId: 'stop-portland',
    type: 'flight',
    airline: 'JetBlue',
    flightNumber: 'B6 274',
    origin: 'BOS',
    destination: 'PWM',
    departureDate: '2026-07-10',
    departureTime: '7:15 AM',
    arrivalTime: '8:22 AM',
    confirmationCode: 'JBLMNE',
  },
  {
    id: 'booking-hotel-portland',
    tripId: 'dev-trip-001',
    stopId: 'stop-portland',
    type: 'hotel',
    hotelName: 'Press Hotel',
    checkIn: '2026-07-10',
    checkOut: '2026-07-12',
    confirmationCode: 'PHR2026',
  },
  {
    id: 'booking-rental-1',
    tripId: 'dev-trip-001',
    stopId: 'stop-portland',
    type: 'rental',
    company: 'Enterprise',
    carType: 'Compact SUV',
    pickupDate: '2026-07-10',
    pickupTime: '9:00 AM',
    dropoffDate: '2026-07-15',
    pickupLocation: 'Portland Jetport',
    dropoffLocation: 'Trenton, ME',
  },
  {
    id: 'booking-hotel-bar-harbor',
    tripId: 'dev-trip-001',
    stopId: 'stop-bar-harbor',
    type: 'hotel',
    hotelName: 'Bar Harbor Inn',
    checkIn: '2026-07-12',
    checkOut: '2026-07-15',
  },
];

export const DEV_ITINERARY: Record<string, ItineraryDay[]> = {
  'stop-portland': [
    {
      id: 'day-pdx-1',
      stopId: 'stop-portland',
      dateIso: '2026-07-10',
      items: [
        { id: 'i-pdx-1-1', type: 'custom', label: 'Arrive PWM · Pick up rental car', time: '8:22 AM', category: 'transport', order: 0 },
        { id: 'i-pdx-1-2', type: 'custom', label: 'Duckfat lunch',                   time: '12:00 PM', category: 'restaurant', order: 1 },
        { id: 'i-pdx-1-3', type: 'custom', label: 'Portland Head Light',             time: '3:00 PM',  category: 'sight',      order: 2 },
      ],
    },
    {
      id: 'day-pdx-2',
      stopId: 'stop-portland',
      dateIso: '2026-07-11',
      items: [
        { id: 'i-pdx-2-1', type: 'custom', label: 'Maine Narrow Gauge Railroad', time: '10:00 AM', category: 'activity',   order: 0 },
        { id: 'i-pdx-2-2', type: 'custom', label: 'Eventide Oyster Co.',         time: '6:00 PM',  category: 'restaurant', order: 1 },
      ],
    },
  ],
  'stop-bar-harbor': [
    {
      id: 'day-bh-1',
      stopId: 'stop-bar-harbor',
      dateIso: '2026-07-12',
      items: [
        { id: 'i-bh-1-1', type: 'custom', label: 'Drive to Bar Harbor (2.5 hrs)', time: '9:00 AM',  category: 'transport',  order: 0 },
        { id: 'i-bh-1-2', type: 'custom', label: 'Check in · Bar Harbor Inn',     time: '3:00 PM',  category: 'custom',     order: 1 },
        { id: 'i-bh-1-3', type: 'custom', label: "Geddy's pub dinner",            time: '7:00 PM',  category: 'restaurant', order: 2 },
      ],
    },
    {
      id: 'day-bh-2',
      stopId: 'stop-bar-harbor',
      dateIso: '2026-07-13',
      items: [
        { id: 'i-bh-2-1', type: 'custom', label: 'Acadia National Park hike',   time: '8:00 AM',   category: 'hike',       order: 0 },
        { id: 'i-bh-2-2', type: 'custom', label: 'Jordan Pond House lunch',     time: '12:30 PM',  category: 'restaurant', order: 1 },
        { id: 'i-bh-2-3', type: 'custom', label: 'Cadillac Mountain sunset',    time: '7:30 PM',   category: 'sight',      order: 2 },
      ],
    },
    {
      id: 'day-bh-3',
      stopId: 'stop-bar-harbor',
      dateIso: '2026-07-14',
      items: [
        { id: 'i-bh-3-1', type: 'custom', label: 'Trailhead Cafe breakfast', time: '8:00 AM',  category: 'restaurant', order: 0 },
        { id: 'i-bh-3-2', type: 'custom', label: 'Morning kayak tour',       time: '10:00 AM', category: 'activity',   order: 1 },
      ],
    },
  ],
};
