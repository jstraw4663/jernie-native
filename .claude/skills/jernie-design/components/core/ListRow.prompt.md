Use for every list of things in the app — itinerary items, search results, settings, companions.

```jsx
<ListRow title="Atlantic Oceanside" sub="Bar Harbor · checked in" subTone="accent"
  media={<img src={photo} />} trailing={<Badge label="Booked" tone="accent" />} />
```

`tone="plain"` for dense chronological lists (Agenda); `tone="default"` when rows need to read as separate cards (Home).
