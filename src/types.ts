// Core domain types for Jernie Native.
// Data split: RTDB = live user state. Firestore = enrichment cache (read-only from client).

export type PlaceCategory = 'restaurant' | 'activity' | 'sight' | 'hike' | 'bar' | 'flight' | 'other';
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
  // Denormalized read index only — the authoritative role always lives at
  // trips/{tripId}/members/{uid}.role.
  trips: Record<string, { role: TripMemberRole; joinedAt: number }>;
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
  // Soft-delete marker. Set by archiveTrip, cleared by restoreTrip. A future scheduled
  // job hard-deletes trips archived beyond a retention window; nothing does that today,
  // so an archived trip's data stays intact and restorable.
  deletedAt?: number | null;
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
  order: number;
}

// `color` is never persisted — it's always derived live from `trip.colorPack` + `stop.order`
// (see `src/domain/trip.ts`'s `getStopColor`). This is the only place a resolved color
// should ever live on a stop-shaped object.
export type StopWithColor = Stop & { color: string };

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
  // Coordinates — needed to compute this place's canonical enrichment-cache key
  // (see src/domain/placeEnrichment.ts). Optional because most curated places today
  // predate coordinate capture; only backfilled where a one-time enrichment import
  // or future auto-seed flow has resolved them.
  lat?: number;
  lon?: number;
  // Hand-curated fields (not API-fetched — these are ours, so they live directly on the
  // RTDB-backed type, not the Firestore enrichment path).
  rating?: number;
  price?: string;
  difficulty?: string;
  duration?: string;
  distance?: string;
  photoUrl?: string;
  subcategory?: string;
  emoji?: string;
}

// ── Bookings ────────────────────────────────────────────────────────────────

export interface BookingBase {
  id: string;
  tripId: string;
  stopId: string;
  type: BookingType;
  groupIds?: string[] | null;
}

export interface FlightLeg {
  flightNumber: string;
  airline: string;
  origin: string;       // IATA
  destination: string;  // IATA
  departureDate: string;
  departureTime: string;
  arrivalTime: string;
}

export interface FlightBooking extends BookingBase {
  type: 'flight';
  legs: FlightLeg[];  // real data has connecting flights (e.g. CLT→BWI→PWM as 2 legs) — never a single flat leg
  confirmationCode?: string;
}

export interface HotelBooking extends BookingBase {
  type: 'hotel';
  hotelName: string;
  checkIn: string;   // YYYY-MM-DD
  checkOut: string;  // YYYY-MM-DD
  roomType?: string;
  confirmationCode?: string;
  address?: string;
}

export interface RentalBooking extends BookingBase {
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
  // Present only when dropoff city != pickup city; `stopId` is always the pickup stop.
  dropoffStopId?: string;
}

export interface RestaurantBooking extends BookingBase {
  type: 'restaurant';
  restaurantName: string;
  date: string;         // YYYY-MM-DD
  time?: string;        // "H:MM AM/PM", e.g. "7:30 PM". Absent = walk-in / no specific time.
  partySize?: number;
  confirmationCode?: string;
}

export type Booking = FlightBooking | HotelBooking | RentalBooking | RestaurantBooking;

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
  notes?: string;
  order: number;
  locked?: boolean;
  groupIds?: string[] | null;
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
  handle: string;   // denormalized at join time — avoids reading another user's private users/{uid} profile to render a member list
  role: TripMemberRole;
  joinedAt: number;
}

export interface Group {
  id: string;
  tripId: string;
  name: string;
  memberUids: string[];
  createdBy: string;   // uid
  createdAt: number;
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
  author: string;   // uid — database.rules.json binds this to auth.uid
  createdAt: number;
  /**
   * Inherited from the PWA's Bugs tab, which sorted reports in-app. Nothing reads
   * bug_reports in-app now (.read is false), so nothing writes this — optional rather than
   * removed, in case an admin surface ever wants it back.
   */
  order?: number;
}

// ── Enrichment (Firestore, read-only from client) ────────────────────────────

export interface Review {
  author: string;
  rating: number;
  text: string;
  time: number;
}

export interface PlaceEnrichment {
  // Stored at `place_enrichment/{canonicalKey}` — a flat, global collection keyed by
  // an app-owned canonical key (normalized name + rounded lat/lon, see
  // src/domain/placeEnrichment.ts), NOT by any provider's proprietary ID or by trip.
  // This is what lets the same physical place enriched via different trips (or
  // eventually different providers) share one cached record instead of duplicating
  // API spend. Provider IDs below are just fields, recording which service(s) actually
  // supplied this record — e.g. imported legacy Google Places data has googlePlaceId
  // set and fsq_id unset, until real Foursquare-based enrichment populates fsq_id later.
  fsq_id?: string;
  googlePlaceId?: string;
  name: string;
  lat: number;
  lon: number;
  phone?: string;
  website?: string;
  hours?: string[];
  address: string;
  rating?: number;
  ratingCount?: number;
  price?: string;  // dollar-sign string ("$$$"), matching Place.price's convention
  photos: string[];
  reviews?: Review[];
  reviews_cached_at?: number;
  cached_at: number;
  place_id_locked: true;
  // Set when a live Foursquare lookup ran and found no match for the place, so callers
  // (useFirestoreEnrichment) can distinguish "looked and found nothing" from "never
  // looked" without re-querying the API every time (no TTL/refresh in v1 — see roadmap).
  fsq_not_found?: boolean;
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
