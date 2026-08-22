---
name: jernie-design
description: "The Jernie design system — tokens, components, voice, and the React Native library mapping. Use for ANY visual or UI work in this app — building or restyling a screen, tab, sheet, row, card, button, chip or badge; choosing a colour, font, size, radius, shadow or spacing value; writing user-facing copy; adding icons; or implementing anything from the redesign mockups. Also use when asked about the palette, typography, the collapse animation, gap rows, or which library to use for a UI behaviour."
---

# Jernie design system

Read `README.md` first — it is the system. Then the file you need:

| You are… | Read |
| --- | --- |
| writing any React Native component | `reference/react-native-mapping.md` — **before** you write it |
| about to hand-roll something | `reference/custom-components.md` — the blocking rule |
| picking a colour / size / radius / duration | `tokens/*.css` — the only source of truth |
| building one of the twelve components | `components/{core,travel}/<Name>.{d.ts,prompt.md,jsx}` |
| animating a header | `reference/collapse.md` |
| putting type on a photo | `reference/photo-scrim.md` |
| writing user-facing words | `reference/voice.md` |
| planning a session's scope | `reference/build-order.md` |
| needing pixel truth — a screen | `docs/design/Jernie Screen.dc.html` — all five tabs and the detail sheet, light + dark, three trip states |
| needing pixel truth — the wizard | `docs/design/Jernie Wizard.dc.html` — four steps, four sheets, first-run home |
| the reasoning behind a screen | `docs/design/Jernie Spec.dc.html`, `docs/design/Jernie Onboarding.dc.html` |

Each component has three files: `.d.ts` is the prop contract, `.prompt.md` is when and how
to use it, `.jsx` is the web reference implementation — the exact structure and styling to
translate. Match the `.jsx`; do not reinterpret it.

---

## Standing rules

**These apply to every session, without being repeated.**

The design system in this folder describes **what the app should become, not what it
currently is**. The existing navy / gold / cream palette and all emoji iconography are being
replaced wholesale — do not preserve them, and do not merge old values into new files.

- **Build only what the current brief describes. If you finish early, stop.**
- **Use the library named in `reference/react-native-mapping.md` for each behaviour.** Do not
  hand-roll anything that file assigns to a library. Do not add a dependency it does not name
  without saying why first.
- **Anything genuinely custom must be called out before it is written**, and recorded in
  `reference/custom-components.md`. See the blocking rule there.
- **Do not change Firebase schemas, security rules, or backend logic.**
- **Do not write new tests unless asked; do keep existing tests passing.**
- **Match the reference screens exactly** — spacing, type sizes, radii and colours come from
  `tokens/`, not from judgement. If a value is missing, ask.
- **There is no logo and no owned photography yet.** Where a mark would go, set the word
  "Jernie" in DM Sans 700. Screens never hard-code an image URL.
- **When you finish, list: files changed, deps added, anything you had to guess.**

## The short version of the system

- **One accent** — teal `--accent` for anything secured (booked, checked in, now).
  **One warning** — amber `--warning` for anything unfinished. Red is for a cancelled
  booking and appears almost never.
- **Three families, one job each.** Fraunces 400 names things (never labels or buttons,
  never below 20px). DM Sans runs the interface. DM Mono carries anything that lines up in
  a column — that mono column is why an itinerary reads as a timetable.
- **20px gutter on every screen, no exceptions.** 44px minimum hit target. Flex/grid with
  `gap`, never margin chains.
- **A card has a border or a shadow, never both.** Selected is a 1.5px accent border plus a
  9% accent fill — never a shadow change.
- **Press is opacity 0.85 plus a light haptic.** Never a scale, never a colour change.
  There is no hover; this is a phone.
- **Empty states are actions.** An empty list is a `PromptRow`, not an illustration.
- **No emoji.** Phosphor icons, regular for inactive, fill for active.

## Working outside the app

If asked for a mock, prototype or slide rather than production code, copy `tokens/*.css`
into a static HTML file and build against the same variables. The system is identical; only
the runtime differs.

## Provenance

Imported from Claude Design project `96c8aef2-f975-4e2c-8c09-cea27dfb1575`
("Mobile app redesign project"). `README.md`, `tokens/*`, `reference/react-native-mapping.md`
and all `components/**` are verbatim, as are the four canvases and `support.js` in `docs/design/`
(original filenames kept — `support.js` resolves `dc-import` as `<name>.dc.html`). `collapse.md`, `voice.md` and `photo-scrim.md` are
distilled from HTML specimens. `custom-components.md` is new. `build-order.md` is the
upstream handoff plus repo-verified annotations.
