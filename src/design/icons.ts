// Icon registry — the icon half of the two-axis taxonomy in docs/redesign-plan.md §8.
//
//   Category (closed set of 10)  owns the colour, the Agenda group and the gap rule.
//   Subtype  (open string)       owns the icon and the default label. Never affects logic.
//
// Colour is the scarce resource; Phosphor glyphs are effectively free. So `camping` and
// `hotel` share one colour, one Agenda section and one gap rule while showing a tent and a
// bed. Adding a travel style is one entry here — no type change, no migration.
//
// Imports are per-icon. Metro does not tree-shake barrels and phosphor's index is over
// 500KB, so `import { BedIcon } from 'phosphor-react-native/src/icons/Bed'` is the only
// form allowed. The `phosphor-react-native` in each icon file's own import is type-only and
// erases at compile time.

import type { Icon } from 'phosphor-react-native';
import { AirplaneTiltIcon } from 'phosphor-react-native/src/icons/AirplaneTilt';
import { AnchorIcon } from 'phosphor-react-native/src/icons/Anchor';
import { ArmchairIcon } from 'phosphor-react-native/src/icons/Armchair';
import { BarbellIcon } from 'phosphor-react-native/src/icons/Barbell';
import { BedIcon } from 'phosphor-react-native/src/icons/Bed';
import { BicycleIcon } from 'phosphor-react-native/src/icons/Bicycle';
import { BinocularsIcon } from 'phosphor-react-native/src/icons/Binoculars';
import { BoatIcon } from 'phosphor-react-native/src/icons/Boat';
import { BookOpenIcon } from 'phosphor-react-native/src/icons/BookOpen';
import { BuildingsIcon } from 'phosphor-react-native/src/icons/Buildings';
import { BusIcon } from 'phosphor-react-native/src/icons/Bus';
import { CableCarIcon } from 'phosphor-react-native/src/icons/CableCar';
import { CarProfileIcon } from 'phosphor-react-native/src/icons/CarProfile';
import { CoffeeIcon } from 'phosphor-react-native/src/icons/Coffee';
import { CompassIcon } from 'phosphor-react-native/src/icons/Compass';
import { ConfettiIcon } from 'phosphor-react-native/src/icons/Confetti';
import { FlowerLotusIcon } from 'phosphor-react-native/src/icons/FlowerLotus';
import { ForkKnifeIcon } from 'phosphor-react-native/src/icons/ForkKnife';
import { AirplaneTakeoffIcon } from 'phosphor-react-native/src/icons/AirplaneTakeoff';
import { HandbagIcon } from 'phosphor-react-native/src/icons/Handbag';
import { HouseLineIcon } from 'phosphor-react-native/src/icons/HouseLine';
import { ImageSquareIcon } from 'phosphor-react-native/src/icons/ImageSquare';
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin';
import { MartiniIcon } from 'phosphor-react-native/src/icons/Martini';
import { MountainsIcon } from 'phosphor-react-native/src/icons/Mountains';
import { MusicNotesIcon } from 'phosphor-react-native/src/icons/MusicNotes';
import { PawPrintIcon } from 'phosphor-react-native/src/icons/PawPrint';
import { PersonSimpleBikeIcon } from 'phosphor-react-native/src/icons/PersonSimpleBike';
import { PersonSimpleHikeIcon } from 'phosphor-react-native/src/icons/PersonSimpleHike';
import { PersonSimpleRunIcon } from 'phosphor-react-native/src/icons/PersonSimpleRun';
import { PersonSimpleSkiIcon } from 'phosphor-react-native/src/icons/PersonSimpleSki';
import { PersonSimpleSwimIcon } from 'phosphor-react-native/src/icons/PersonSimpleSwim';
import { PicnicTableIcon } from 'phosphor-react-native/src/icons/PicnicTable';
import { StorefrontIcon } from 'phosphor-react-native/src/icons/Storefront';
import { SubwayIcon } from 'phosphor-react-native/src/icons/Subway';
import { SunHorizonIcon } from 'phosphor-react-native/src/icons/SunHorizon';
import { TaxiIcon } from 'phosphor-react-native/src/icons/Taxi';
import { TentIcon } from 'phosphor-react-native/src/icons/Tent';
import { TicketIcon } from 'phosphor-react-native/src/icons/Ticket';
import { TrainIcon } from 'phosphor-react-native/src/icons/Train';
import { TramIcon } from 'phosphor-react-native/src/icons/Tram';
import { TreePalmIcon } from 'phosphor-react-native/src/icons/TreePalm';
import { UsersThreeIcon } from 'phosphor-react-native/src/icons/UsersThree';
import { VanIcon } from 'phosphor-react-native/src/icons/Van';
import { WineIcon } from 'phosphor-react-native/src/icons/Wine';

/** The closed set of 10. Owns colour, Agenda group and gap rule. */
export type ItemCategory =
  | 'flight' | 'transit' | 'car'
  | 'stay'
  | 'food' | 'bars'
  | 'hike' | 'activity' | 'sight' | 'shopping';

/** One icon per category — the fallback when a subtype is absent or unrecognised. */
export const CATEGORY_ICONS: Record<ItemCategory, Icon> = {
  flight:   AirplaneTiltIcon,
  transit:  TrainIcon,
  car:      CarProfileIcon,
  stay:     BedIcon,
  food:     ForkKnifeIcon,
  bars:     WineIcon,
  hike:     PersonSimpleHikeIcon,
  activity: TicketIcon,
  sight:    BuildingsIcon,
  shopping: StorefrontIcon,
};

/**
 * Known subtypes. Keys are lower-cased, whitespace-collapsed strings — the same normalising
 * `iconFor` applies, so "Vacation Rental" and "vacation rental" both hit.
 *
 * An unknown subtype is not an error: it falls back to its category's icon, so old data
 * carrying a value nobody registered degrades cleanly instead of throwing.
 */
export const SUBTYPE_ICONS: Record<string, Icon> = {
  // flight
  'seaplane': BoatIcon,
  'helicopter': AirplaneTakeoffIcon,
  // transit
  'train': TrainIcon,
  'subway': SubwayIcon,
  'tram': TramIcon,
  'bus': BusIcon,
  'coach': BusIcon,
  'ferry': BoatIcon,
  'shuttle': VanIcon,
  'funicular': CableCarIcon,
  'walk': PersonSimpleRunIcon,
  'bike': BicycleIcon,
  // car
  'rental': CarProfileIcon,
  'own car': CarProfileIcon,
  'taxi': TaxiIcon,
  'rideshare': TaxiIcon,
  'campervan': VanIcon,
  // stay
  'hotel': BedIcon,
  'vacation rental': HouseLineIcon,
  'hostel': BedIcon,
  'b&b': HouseLineIcon,
  'inn': HouseLineIcon,
  'resort': TreePalmIcon,
  'cabin': HouseLineIcon,
  'camping': TentIcon,
  'rv': VanIcon,
  'boat': AnchorIcon,
  'with friends': UsersThreeIcon,
  // food
  'restaurant': ForkKnifeIcon,
  'cafe': CoffeeIcon,
  'bakery': CoffeeIcon,
  'market': StorefrontIcon,
  'food truck': PicnicTableIcon,
  // bars
  'bar': MartiniIcon,
  'brewery': WineIcon,
  'winery': WineIcon,
  'distillery': WineIcon,
  'pub': WineIcon,
  'club': MusicNotesIcon,
  // hike
  'hike': PersonSimpleHikeIcon,
  'trail': PersonSimpleHikeIcon,
  'summit': MountainsIcon,
  'climb': MountainsIcon,
  'bike ride': PersonSimpleBikeIcon,
  'paddle': BoatIcon,
  'ski': PersonSimpleSkiIcon,
  'run': PersonSimpleRunIcon,
  // activity
  'tour': CompassIcon,
  'show': TicketIcon,
  'concert': MusicNotesIcon,
  'theatre': TicketIcon,
  'sports': BarbellIcon,
  'spa': FlowerLotusIcon,
  'class': BookOpenIcon,
  'beach': TreePalmIcon,
  'wildlife': PawPrintIcon,
  'water sports': PersonSimpleSwimIcon,
  // sight
  'museum': BuildingsIcon,
  'gallery': ImageSquareIcon,
  'monument': BuildingsIcon,
  'viewpoint': BinocularsIcon,
  'park': SunHorizonIcon,
  'garden': SunHorizonIcon,
  'landmark': BuildingsIcon,
  // shopping
  'shop': StorefrontIcon,
  'mall': StorefrontIcon,
  'bookstore': BookOpenIcon,
  'boutique': HandbagIcon,
  // misc, not a taxonomy subtype but used by existing surfaces
  'celebration': ConfettiIcon,
  'lounge': ArmchairIcon,
};

/** Anything with no category at all — a bare place, a stop, a dropped pin. */
export const PLACE_ICON: Icon = MapPinIcon;

const normalise = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Resolve an icon: subtype first, then category, then the generic place pin. Never throws
 * and never returns undefined — an unrecognised value is a fallback, not a failure.
 */
export function iconFor(category?: string | null, subtype?: string | null): Icon {
  if (subtype) {
    const hit = SUBTYPE_ICONS[normalise(subtype)];
    if (hit) return hit;
  }
  if (category) {
    const key = normalise(category) as ItemCategory;
    if (key in CATEGORY_ICONS) return CATEGORY_ICONS[key];
    const sub = SUBTYPE_ICONS[key];
    if (sub) return sub;
  }
  return PLACE_ICON;
}
