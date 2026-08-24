# Jernie itinerary timeline — design contract

Source of visual truth: the completed Jernie Itinerary Design canvas.

Goal: replace the Jernie tab's per-stop day list with one continuous trip timeline while
preserving the existing photo collapse, stop rail, CTA priority, CRUD sheets, and Session 6
detail-sheet entry points.

## Product decisions

- Ship the structural timeline first. Navigation, destructive swipes, and reorder are later gates.
- Navigation can remember a preferred maps app on the user's profile. The decision sheet has
  an "Always use <app>" checkbox; without a saved preference it opens every time.
- Loose plans reorder without confirmation. A booked or locked item can move, but the drop
  opens a decision sheet before it is persisted.
- Removing a booking-backed row removes the reservation through `removeBooking`, including its
  linked itinerary rows. Removing a place/custom row removes only that itinerary item.

## Chronology

- The screen is one vertical chronology. The stored stop-keyed day map is an input, never the
  render shape.
- A date appears once when it is both one stop's departure date and the next stop's arrival
  date. That day contains two ordered stop segments and one handoff.
- Visible dates are the union of inclusive stop ranges, itinerary dates, and booking-event
  dates, so red-eye travel outside a stop range remains visible.
- Every day declares all five bands, including empty ones:

  | Key | Label | Range |
  | --- | --- | --- |
  | `early` | Early | 05:00–08:59 |
  | `morning` | Morning | 09:00–11:59 |
  | `afternoon` | Afternoon | 12:00–16:59 |
  | `evening` | Evening | 17:00–20:59 |
  | `late` | Late | 21:00–04:59 |

- Exact clocks are hard times. Recognized phrases such as mid-morning, afternoon, sunset,
  evening, and late night are loose times and retain their wording.
- Missing or unrecognized times are unscheduled, not silently assigned to a false band.
- Past hard-time rows recede. Loose and unscheduled rows on today never become past because
  the data cannot support that claim. Exactly one non-past row may be next.

## Row truth

- An itinerary item is the primary placement when it references a place or booking. Its day
  and optional time win; referenced data supplies title, category, photo, and status.
- A booking with no itinerary placement still appears. Flights depart, hotels check in and
  out, rentals pick up and drop off, and restaurant reservations occur on their own dates.
- A booking-backed or `locked` item requires confirmation before a move.
- Type colour is confined to glyphs and tiles. Teal means secured/now, amber means unfinished.
- Place photography comes only through the existing resolver. No screen owns a URL.

## Derived context

- A hotel's half-open check-in/check-out span supplies the night's base strip. Check-out
  morning is not another night.
- A transition names the outgoing and incoming stops. Route duration is omitted until a
  routing provider exists.
- Gap prompts reuse `deriveTripCoverage`; no second definition of missing coverage is added.
- Empty-band prompts appear only for today and tomorrow. Other empty bands remain quiet.
- Per-item attendee avatars are omitted until the data model can represent attendance.

## Interaction contract

- Scroll position owns the active day and stop. Date-rail taps scroll to a measured day.
- The pinned stop bar scrolls the visible day to its top; a second tap returns to trip top.
- The Today pill appears only when the visible day is more than one day from today.
- Row press opens the shared detail sheet for places/bookings and the existing editor for
  custom rows.
- Row swipes use `react-native-gesture-handler`. Reorder is long-press driven and waits for the
  atomic write and confirmation contracts.

## Isolated-foundation boundary

The first pass may add a pure domain model, new files under `src/features/jernie/itinerary`,
tests, and design-register entries. It must not modify `jernie.tsx`, Agenda, Explore, or
`sheets/detail` until Session 6 is committed and this branch is rebased onto it.
