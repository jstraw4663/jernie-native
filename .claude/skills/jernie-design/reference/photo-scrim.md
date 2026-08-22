# Photography and scrims

*Distilled from `guidelines/photo-scrim.html` in the source project.*

**Photography is the brand.** Every trip, stop and place has a photo. The layout's job is
to keep type legible over it without dulling it.

Type never sits directly on an image at small sizes. It gets one of two treatments:

1. **A three-stop scrim** — for type that sits on the photo (hero titles, stop names)
2. **A white card lifted off the photo** — `--shadow-card`, no border

Images are warm and natural: landscape and food photography. No filters, no duotone,
no grain.

## The scrim

A single vertical gradient across the whole image, three stops:

```css
background: linear-gradient(180deg,
  var(--scrim-top)    0%,     /* rgba(16, 24, 20, 0.50) */
  var(--scrim-mid)    40%,    /* rgba(16, 24, 20, 0.12) */
  var(--scrim-bottom) 100%);  /* rgba(20, 32, 27, 0.90) */
```

Dark at the top so status-bar content and top chips stay readable, nearly clear through the
middle so the photograph is actually visible, heaviest at the bottom where the title sits.
`--scrim-bottom` is the one scrim token that changes in dark mode
(`rgba(14, 12, 11, 0.94)`).

## Type on the scrim

Positioned bottom-left, `16px` from the left edge, `14px` from the bottom:

- **Name** — `--text-title` (Fraunces 400, 24px) in `--on-photo` (`#FFFFFF`)
- **Subline** — `--text-sub` (DM Sans 400, 11px) in `--on-photo-2` (72% white), `5px` below

## Controls on a photo

The only place transparency and blur are allowed. A control sitting on a hero is a
`32px` circle, `--radius-full`, filled `--on-photo-chip` (18% white) with an `8px`
backdrop blur. Never over a solid surface.

## React Native

- Scrim: `expo-linear-gradient` (already a dependency) with the three stops above
- Blur chips: `expo-blur` — iOS renders the blur, Android falls back to solid
- Images: `expo-image` with `cachePolicy="memory-disk"` and a `placeholder` blurhash;
  plain `Image` re-fetches and flickers on scroll

Screens never hard-code an image URL. Photography is resolved at trip and stop creation.
