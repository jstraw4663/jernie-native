export interface TripColorPack {
  id: string;
  name: string;
  description: string;
  stopColors: string[];  // cycles if trip has more stops than array length
  heroGradient: [string, string];
}

export const TRIP_COLOR_PACKS: TripColorPack[] = [
  {
    id: 'coastal',
    name: 'Coastal',
    description: 'Northeast, Pacific coast, maritime',
    stopColors: ['#2C5880', '#1E7B8C', '#2F6B47', '#3A5E72'],
    heroGradient: ['#0D2B3E', '#2C5880'],
  },
  {
    id: 'desert',
    name: 'Desert Sun',
    description: 'Southwest, Utah, Arizona, Morocco',
    stopColors: ['#B8622A', '#9B4E2A', '#C47840', '#8B5E3A'],
    heroGradient: ['#2E1508', '#B8622A'],
  },
  {
    id: 'alpine',
    name: 'Alpine',
    description: 'Mountains, Rockies, Alps, Colorado',
    stopColors: ['#2D6A4F', '#1B4332', '#40916C', '#3A6E58'],
    heroGradient: ['#081C15', '#2D6A4F'],
  },
  {
    id: 'dusk',
    name: 'Dusk',
    description: 'European cities, urban, Japan',
    stopColors: ['#6B5B95', '#8B6AA5', '#7A4F85', '#5A4880'],
    heroGradient: ['#1A0A30', '#6B5B95'],
  },
  {
    id: 'coral',
    name: 'Coral Sea',
    description: 'Tropical, Caribbean, Hawaii, Mediterranean',
    stopColors: ['#C85A4A', '#E07A5F', '#B84A62', '#D46A3A'],
    heroGradient: ['#3E1008', '#C85A4A'],
  },
  {
    id: 'steel',
    name: 'Steel',
    description: 'Nordic, Scandinavia, Iceland, urban winter',
    stopColors: ['#4A6FA5', '#3A5A90', '#5A7AB5', '#3E6088'],
    heroGradient: ['#0A1828', '#4A6FA5'],
  },
];

/** Returns the stop color at position `order`, cycling if needed. */
export function resolveStopColor(pack: Pick<TripColorPack, 'stopColors'>, order: number): string {
  return pack.stopColors[order % pack.stopColors.length];
}

/** Returns the pack with `id`, falling back to 'coastal'. */
export function getPackById(id: string): TripColorPack {
  return TRIP_COLOR_PACKS.find(p => p.id === id) ?? TRIP_COLOR_PACKS[0];
}

/**
 * Auto-suggest a pack based on keyword match in trip name/city names.
 * LLM-improved version in Phase 2; this is the simple keyword fallback.
 */
export function suggestPack(text: string): TripColorPack {
  const t = text.toLowerCase();
  if (/maine|coast|ocean|beach|harbor|sea|cape|island/.test(t)) return getPackById('coastal');
  if (/utah|arizona|desert|canyon|sedona|santa fe|moab/.test(t)) return getPackById('desert');
  if (/colorado|alps|mountain|rocky|glacier|ski|tahoe/.test(t)) return getPackById('alpine');
  if (/paris|rome|london|tokyo|japan|europe|city/.test(t)) return getPackById('dusk');
  if (/hawaii|caribbean|bali|cancun|tropical|bahamas/.test(t)) return getPackById('coral');
  if (/iceland|norway|sweden|finland|alaska|nordic/.test(t)) return getPackById('steel');
  return TRIP_COLOR_PACKS[0]; // default: coastal
}
