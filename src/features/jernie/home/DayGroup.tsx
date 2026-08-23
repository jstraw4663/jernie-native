// One day on the home screen: a mono date label, a Today badge, a plan count, then the
// day's rows. Flat — every day is open. The accordion that `StopSection` used is gone; the
// design shows the whole stop at once and sends dense browsing to Agenda.
//
// Rows are `ItineraryRow` from src/ui. This file decides *what* a row says; it draws none
// of it. Gap rows slot in below the items once src/domain/gaps.ts exists (Session 5).
import type { Icon } from 'phosphor-react-native';
import { Text, View } from 'react-native';
import { getBookingDisplay } from '@/src/domain/bookings';
import { resolvePlacePhoto } from '@/src/domain/placeEnrichment';
import { iconFor } from '@/src/design/icons';
import { Gutter, Spacing, Typography } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import type { Booking, ItineraryDay, ItineraryItem, Place, PlaceEnrichment } from '@/src/types';
import { Badge, ImagePlaceholder, ItineraryRow, Photo } from '@/src/ui';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export interface DayGroupProps {
  day: ItineraryDay;
  places: Place[];
  bookings: Booking[];
  enrichment: Record<string, PlaceEnrichment>;
  /** YYYY-MM-DD in the user's day, so "Today" and the next-up highlight agree. */
  todayIso: string;
  /** Minutes since midnight, used to find the next thing happening. Only read when today. */
  nowMinutes: number;
  onItemPress: (item: ItineraryItem) => void;
}

interface Derived {
  title: string;
  sub: string;
  Glyph: Icon;
  photo?: string;
  booked: boolean;
}

/** What a row says, resolved from whichever record the item points at. */
function derive(
  item: ItineraryItem,
  places: Place[],
  bookings: Booking[],
  enrichment: Record<string, PlaceEnrichment>,
  todayIso: string,
): Derived {
  if (item.type === 'booking' && item.bookingId) {
    const booking = bookings.find(b => b.id === item.bookingId);
    if (booking) {
      const d = getBookingDisplay(booking, todayIso);
      return { title: d.label, sub: d.meta, Glyph: iconFor(d.category), booked: true };
    }
  }

  if (item.placeId) {
    const place = places.find(p => p.id === item.placeId);
    if (place) {
      return {
        title: place.name,
        sub: place.curatorNote ?? place.subcategory ?? place.category,
        Glyph: iconFor(place.category, place.subcategory),
        photo: resolvePlacePhoto(place, enrichment),
        booked: false,
      };
    }
  }

  // Custom items are free text the traveller wrote; the category is all we can add.
  return {
    title: item.label ?? 'Untitled',
    sub: item.notes ?? '',
    Glyph: iconFor(item.category),
    booked: false,
  };
}

/** "12:10" becomes 730. Anything unparseable sorts last, which is where untimed items belong. */
function minutesOf(time?: string): number {
  if (!time) return Number.MAX_SAFE_INTEGER;
  const [h, m] = time.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : Number.MAX_SAFE_INTEGER;
}

export function DayGroup({
  day, places, bookings, enrichment, todayIso, nowMinutes, onItemPress,
}: DayGroupProps) {
  const [s, t] = useStyles();

  const isToday = day.dateIso === todayIso;
  const d = new Date(`${day.dateIso}T12:00:00`);
  const label = `${WEEKDAYS[d.getDay()]} · ${MONTHS[d.getMonth()]} ${d.getDate()}`;

  const items = [...day.items].sort((a, b) => a.order - b.order);

  // The next thing happening — highlighted in accent, and only ever one of them.
  const nextId = isToday
    ? items.find(i => minutesOf(i.time) >= nowMinutes)?.id
    : undefined;

  return (
    <View style={s.group}>
      <View style={s.header}>
        <Text style={[s.label, { color: isToday ? t.action : t.textFaint }]} numberOfLines={1}>{label}</Text>
        {isToday ? <Badge label="Today" tone="solid" /> : null}
        <Text style={s.meta} numberOfLines={1}>
          {items.length} plan{items.length === 1 ? '' : 's'}
        </Text>
      </View>

      {items.map((item) => {
        const info = derive(item, places, bookings, enrichment, todayIso);
        return (
          <ItineraryRow
            key={item.id}
            testID={`itinerary-item-${item.id}`}
            time={item.time ?? '—'}
            title={info.title}
            sub={info.sub}
            now={item.id === nextId}
            photo={info.photo ? <Photo source={info.photo} style={s.fill} /> : undefined}
            icon={info.photo ? undefined : <ImagePlaceholder Glyph={info.Glyph} style={s.fill} glyphSize={19} />}
            badge={info.booked ? <Badge label="Booked" tone="accent" /> : undefined}
            onPress={() => onItemPress(item)}
          />
        );
      })}
    </View>
  );
}

const useStyles = createThemedStyles((t) => ({
  group: { paddingHorizontal: Gutter, paddingTop: Spacing.sectionGap },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 2 },
  label: { ...Typography.roles.data, letterSpacing: 0.55 },
  meta: {
    fontSize: 10.5, lineHeight: 10.5,
    fontFamily: 'DMSans', fontWeight: '400' as const,
    color: t.textFaint, marginLeft: 'auto',
  },
  fill: { width: '100%', height: '100%' },
}));
