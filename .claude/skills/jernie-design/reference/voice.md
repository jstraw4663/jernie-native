# Voice

*Distilled from `guidelines/voice.html` in the source project. See also the "Content
fundamentals" section of `README.md`.*

**A well-briefed friend who has read your itinerary.** Plain, specific, never cheerful
about problems.

## The four worked examples

| | Line | Why |
| --- | --- | --- |
| ✓ | "Nowhere to sleep in Southwest Harbor" | Names the actual problem in plain words |
| ✓ | "No transport · the car drops off before you arrive" | Explains the cause, not just the state |
| ✓ | "Nothing booked yet is a perfectly normal answer" | Takes the shame out of an empty answer |
| ✗ | "Oops! Something went wrong" | Never. No apologies, no exclamation marks, no emoji |

## Rules

- **Name the thing, then the consequence.** "No transport in Southwest Harbor" then
  "May 27 – 29 · the car drops off before you arrive". Never "Something's missing!"
- **Second person, present tense.** "Where you're staying", "You're checked in".
  Section headers are phrases, not nouns: *Where you're eating*, not *Dining*.
- **Unfinished is not failure.** No apology, no exclamation mark, no "Oops".
- **Numbers do the arguing.** "7 of 8 nights covered", "2 of 3 stops", "0.4 mi away".
  A sentence that could carry a count carries it.
- **Sentence case everywhere** except the tracked micro-labels (`STOP 2 OF 3`,
  `MON · MAY 25`), which are uppercase DM Sans or DM Mono.
- **No emoji.** Phosphor icons replace them one-for-one.
- **Buttons are verbs the user would say**: Add, Book, Fix, Resend, Switch, Start over.
  Never "Submit", "OK", "Confirm".
- **Sheets state what is at stake before they ask.** The exit sheet names the trip:
  "Maine Coast, 2 stops, May 22 – 29."

## Error copy

There is no generic error string in this system. An error names what failed and what the
user can do about it. `--error` (`#A3485F`) is reserved for a cancelled or failed booking
and appears almost never — an unfinished thing is amber (`--warning`), not red.
