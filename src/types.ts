// Core domain types for Jernie Native.
// Data split: RTDB = live user state. Firestore = enrichment cache (read-only from client).

export type PlaceCategory = 'restaurant' | 'activity' | 'sight' | 'hike' | 'flight' | 'other';
export type BugPriority = 'high' | 'medium' | 'low';
export type UserPlan = 'anonymous' | 'free' | 'pro';
export type TripMemberRole = 'organizer' | 'traveler';
export type PlaceSuggestionStatus = 'pending' | 'approved' | 'rejected';
export type ExploreSuggestionStatus = 'pending' | 'added' | 'dismissed';
export type BookingType = 'flight' | 'hotel' | 'rental' | 'restaurant';

// ── User ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string | null;
  plan: UserPlan;
  createdAt: number;
  anonCreatedAt: number | null;  // set on anon creation, cleared on link
  trips: Record<string, true>;
}

// ── Trip ────────────────────────────────────────────────────────────────────

export interface SetupIntent {
  flights: boolean;
  stays: boolean;
  car: boolean;
  restaurants: boolean;
}

export interface TripColorPackRef {
  id: string;
  stopColors: string[];
  heroGradient: [string, string];
}

export interface Trip {
  id: string;
  name: string;
  ownerUid: string;
  createdAt: number;
  pills: string[];
  inviteToken: string;
  colorPack: TripColorPackRef;
  setupIntent: SetupIntent;
}

// ── Stop ────────────────────────────────────────────────────────────────────

export interface Stop {
  id: string;
  tripId: string;
  city: string;
  region: string;
  emoji: string;
  lat: number;
  lon: number;
  dates: { start: string; end: string };  // ISO date strings YYYY-MM-DD
  color: string;  // resolved from colorPack at creation
  order: number;
}

// ── Place ───────────────────────────────────────────────────────────────────

export interface Place {
  id: string;
  tripId: string;
  stopId: string;
  name: string;
  category: PlaceCategory;
  must: boolean;
  curatorNote?: string;
  addr?: string;        // hike trailheads only
  source: 'curator' | 'community';
  addedBy: string;      // uid
  fsq_id?: string;      // Foursquare canonical ID (set after enrichment)
}

// ── Bookings ────────────────────────────────────────────────────────────────

export interface FlightBooking {
  id: string;
  tripId: string;
  stopId: string;
  type: 'flight';
  flightNumber: string;
  airline: string;
  origin: string;       // IATA code
  destination: string;  // IATA code
  departureDate: string;
  departureTime: string;
  arrivalTime: string;
  confirmationCode?: string;
}

export interface HotelBooking {
  id: string;
  tripId: string;
  stopId: string;
  type: 'hotel';
  hotelName: string;
  checkIn: string;   // YYYY-MM-DD
  checkOut: string;  // YYYY-MM-DD
  roomType?: string;
  confirmationCode?: string;
  address?: string;
}

export interface RentalBooking {
  id: string;
  tripId: string;
  stopId: string;
  type: 'rental';
  company: string;
  carType?: string;
  pickupDate: string;
  pickupTime?: string;
  dropoffDate: string;
  dropoffTime?: string;
  pickupLocation: string;
  dropoffLocation: string;
  confirmationCode?: string;
}

export type Booking = FlightBooking | HotelBooking | RentalBooking;

// ── Itinerary ───────────────────────────────────────────────────────────────

export type ItineraryItemCategory = PlaceCategory | 'transport' | 'custom';

export interface ItineraryItem {
  id: string;
  type: 'place' | 'booking' | 'custom';
  placeId?: string;
  bookingId?: string;
  label?: string;       // custom items
  time?: string;
  category?: ItineraryItemCategory;
  order: number;
  locked?: boolean;
}

export interface ItineraryDay {
  id: string;
  stopId: string;
  dateIso: string;    // YYYY-MM-DD
  items: ItineraryItem[];
}

// ── Trip members ────────────────────────────────────────────────────────────

export interface TripMember {
  uid: string;
  handle: string;
  role: TripMemberRole;
  joinedAt: number;
}

// ── Community suggestions ────────────────────────────────────────────────────

export interface PlaceSuggestion {
  placeId: string;
  suggestedBy: string;  // uid
  suggestedAt: number;
  note?: string;
  status: PlaceSuggestionStatus;
}

export interface ExploreSuggestion {
  fsq_id: string;
  name: string;
  category: PlaceCategory;
  address: string;
  curatorNote: string;  // LLM-generated
  status: ExploreSuggestionStatus;
  seededAt: number;
}

// ── Feedback ─────────────────────────────────────────────────────────────────

export interface BugReport {
  id: string;
  tripId: string;
  title: string;
  body?: string;
  priority: BugPriority;
  author: string;
  createdAt: number;
  order: number;
}

// ── Enrichment (Firestore, read-only from client) ────────────────────────────

export interface Review {
  author: string;
  rating: number;
  text: string;
  time: number;
}

export interface PlaceEnrichment {
  fsq_id: string;
  name: string;
  lat: number;
  lon: number;
  phone?: string;
  website?: string;
  hours?: string[];
  address: string;
  rating?: number;
  ratingCount?: number;
  price?: number;
  photos: string[];
  reviews?: Review[];
  reviews_cached_at?: number;
  cached_at: number;
  place_id_locked: true;
}

export interface TrailEnrichment {
  name: string;
  distance: number;
  elevationGain: number;
  difficulty: string;
  routeType: string;
  dogFriendly: boolean;
  features: string[];
  photos: string[];
  cached_at: number;
}

export interface HotelEnrichment {
  name: string;
  rating: number;
  amenities: string[];
  photos: string[];
  address: string;
  phone?: string;
  website?: string;
  cached_at: number;
}

// ── Flight status (MMKV cached) ───────────────────────────────────────────────

export interface FlightStatus {
  flightNumber: string;
  status: 'on_time' | 'delayed' | 'cancelled' | 'landed' | 'unknown';
  departureTime: string;
  arrivalTime: string;
  gate_origin?: string;
  terminal_origin?: string;
  terminal_destination?: string;
  baggage_claim?: string;
  aircraft_type?: string;
  delay_minutes?: number;
  checked_at: number;
}

// ── Shared write state ───────────────────────────────────────────────────────

export interface WriteQueueEntry {
  id: string;
  path: string;
  value: unknown;
  timestamp: number;
}
