import type { LayoutChangeEvent } from 'react-native';
import { Pressable, Text, View } from 'react-native';
import { ArrowDownIcon } from 'phosphor-react-native/src/icons/ArrowDown';
import { BedIcon } from 'phosphor-react-native/src/icons/Bed';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { iconFor } from '@/src/design/icons';
import { Gutter, PRESSED_OPACITY, Radius, TypeColors, Typography } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import type {
  TimelineBand, TimelineBandKey, TimelineDay, TimelineEntry,
} from '@/src/domain/itineraryTimeline';
import { Photo, tap } from '@/src/ui';
import { hexWithAlpha } from '@/src/utils/colors';

interface TimelineDayProps {
  day: TimelineDay;
  stopColors: Record<string, string>;
  onEntryPress?: (entry: TimelineEntry) => void;
  onAdd?: (dateIso: string, band: TimelineBandKey) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
}

/** One date in the continuous trip timeline. Scrolling and stickiness belong to integration. */
export function TimelineDayView({
  day, stopColors, onEntryPress, onAdd, onLayout,
}: TimelineDayProps) {
  const [s, t] = useStyles();
  const cities = day.segments.map(segment => segment.city).join(' → ') || 'Travel';

  return (
    <View testID={`timeline-day-${day.dateIso}`} onLayout={onLayout} style={[s.day, day.isPast && s.dayPast]}>
      <View style={s.dayBar} accessibilityRole="header">
        <Text style={s.dayDate}>{day.weekday} {day.dayOfMonth}</Text>
        <View style={s.dayStopMarks}>
          {day.segments.length === 0 ? <View style={[s.dayStopMark, { backgroundColor: t.textFaint }]} /> : null}
          {day.segments.map(segment => (
            <View
              key={segment.stopId}
              style={[s.dayStopMark, { backgroundColor: stopColors[segment.stopId] ?? t.textFaint }]}
            />
          ))}
        </View>
        <Text style={s.dayCity} numberOfLines={1}>{cities}</Text>
        {day.isToday ? <View style={s.today}><Text style={s.todayText}>TODAY</Text></View> : null}
        <Text style={s.count}>{day.count} {day.count === 1 ? 'plan' : 'plans'}</Text>
      </View>

      <View style={s.body}>
        {day.stay ? (
          <View
            testID={`timeline-stay-${day.dateIso}`}
            style={[s.context, !day.stay.confirmed && s.contextWarning]}
            accessibilityLabel={`Tonight. ${day.stay.name}. ${day.stay.detail}`}
          >
            <View style={[s.contextTile, { backgroundColor: hexWithAlpha(TypeColors.stay, 0.1) }]}>
              <BedIcon size={14} color={TypeColors.stay} weight="fill" />
            </View>
            <Text style={s.contextText} numberOfLines={2}>
              <Text style={s.contextLabel}>TONIGHT</Text> · {day.stay.name}
              <Text style={[s.contextDetail, !day.stay.confirmed && { color: t.warning }]}> · {day.stay.detail}</Text>
            </Text>
          </View>
        ) : null}

        {day.transition ? (
          <View testID={`timeline-transition-${day.dateIso}`} style={s.transition}>
            <View style={s.transitionNode}><ArrowDownIcon size={10} color={t.textMuted} weight="bold" /></View>
            <View style={s.transitionCard}>
              <Text style={s.transitionTitle}>
                {day.transition.fromCity} → {day.transition.toCity}
              </Text>
              <Text style={s.transitionSub}>Moving between stops</Text>
            </View>
          </View>
        ) : null}

        {day.bands.map(band => (
          <TimeBand
            key={band.key}
            band={band}
            dateIso={day.dateIso}
            onEntryPress={onEntryPress}
            onAdd={onAdd}
          />
        ))}

        {day.unscheduled.length ? (
          <View testID={`timeline-unscheduled-${day.dateIso}`}>
            <View style={s.bandHeader}>
              <Text style={s.bandSpan}>—</Text>
              <View style={s.spineCol}><View style={s.spineLine} /><View style={s.bandTick} /></View>
              <Text style={s.bandLabel}>UNSCHEDULED</Text>
            </View>
            {day.unscheduled.map(entry => (
              <TimelineEntryRow key={entry.id} entry={entry} onPress={onEntryPress} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function TimeBand({
  band, dateIso, onEntryPress, onAdd,
}: {
  band: TimelineBand;
  dateIso: string;
  onEntryPress?: (entry: TimelineEntry) => void;
  onAdd?: (dateIso: string, band: TimelineBandKey) => void;
}) {
  const [s, t] = useStyles();
  return (
    <View testID={`timeline-band-${dateIso}-${band.key}`}>
      <View style={s.bandHeader}>
        <Text style={s.bandSpan}>{band.span}</Text>
        <View style={s.spineCol}><View style={s.spineLine} /><View style={s.bandTick} /></View>
        <Text style={s.bandLabel}>{band.label}</Text>
      </View>
      {band.entries.map(entry => (
        <TimelineEntryRow key={entry.id} entry={entry} onPress={onEntryPress} />
      ))}
      {band.showEmptyPrompt && band.entries.length === 0 && onAdd ? (
        <View style={s.emptyLine}>
          <View style={s.emptyTime} />
          <View style={s.spineCol}><View style={s.spineLine} /><View style={s.emptyNode} /></View>
          <Pressable
            testID={`timeline-add-${dateIso}-${band.key}`}
            accessibilityRole="button"
            accessibilityLabel={`Nothing planned ${band.label.toLowerCase()}. Add a plan.`}
            hitSlop={7}
            onPress={() => { tap(); onAdd(dateIso, band.key); }}
            style={({ pressed }) => [s.emptyAction, pressed && s.pressed]}
          >
            <PlusIcon size={12} color={t.textMuted} weight="regular" />
            <Text style={s.emptyText}>Nothing planned</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function TimelineEntryRow({
  entry, onPress,
}: {
  entry: TimelineEntry;
  onPress?: (entry: TimelineEntry) => void;
}) {
  const [s, t] = useStyles();
  const Glyph = iconFor(entry.category, entry.subtype);
  const typeColor = entry.category ? TypeColors[entry.category] : t.textFaint;
  const press = onPress ? () => onPress(entry) : undefined;

  return (
    <Pressable
      testID={`timeline-entry-${entry.id}`}
      accessibilityRole={press ? 'button' : undefined}
      accessibilityLabel={[entry.time.label, entry.title, entry.meta].filter(Boolean).join('. ')}
      disabled={!press}
      onPress={press}
      style={({ pressed }) => [s.entry, entry.past && s.entryPast, pressed && press && s.pressed]}
    >
      <Text
        style={[s.entryTime, entry.time.precision !== 'hard' && s.entryTimeLoose]}
        numberOfLines={1}
      >
        {entry.time.label}
      </Text>
      <View style={s.spineCol}>
        <View style={s.spineLine} />
        <View style={[
          s.entryNode,
          entry.time.precision === 'hard'
            ? { backgroundColor: typeColor, borderColor: typeColor }
            : { backgroundColor: t.surface, borderColor: t.textFaint, borderStyle: 'dashed' },
        ]} />
      </View>
      <View style={s.entryContent}>
        <Photo
          source={entry.photo}
          Glyph={Glyph}
          glyphSize={17}
          style={[s.entryTile, !entry.photo && { backgroundColor: hexWithAlpha(typeColor, 0.1) }]}
          accessibilityLabel={entry.photo ? `${entry.title} photo` : undefined}
        />
        <View style={s.entryBody}>
          <Text style={s.entryTitle} numberOfLines={1}>{entry.title}</Text>
          {entry.meta ? <Text style={s.entryMeta} numberOfLines={1}>{entry.meta}</Text> : null}
        </View>
        {entry.secured ? (
          <CheckCircleIcon
            size={16}
            color={entry.confirmed ? t.action : t.warning}
            weight="fill"
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const TIME_WIDTH = 62;
const SPINE_WIDTH = 24;

const useStyles = createThemedStyles((t) => ({
  day: { backgroundColor: t.surface },
  dayPast: { opacity: 0.72 },
  dayBar: {
    height: 34,
    backgroundColor: t.surface,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Gutter,
  },
  dayDate: { ...Typography.roles.data, color: t.text },
  dayStopMarks: { flexDirection: 'row', gap: 2 },
  dayStopMark: { width: 5, height: 5, borderRadius: 3 },
  dayCity: { ...Typography.roles.sub, color: t.textMuted, flex: 1 },
  today: { height: 16, paddingHorizontal: 6, borderRadius: Radius.full, backgroundColor: t.action, justifyContent: 'center' },
  todayText: { fontFamily: 'DMSans-Bold', fontWeight: '700' as const, fontSize: 8, lineHeight: 8, letterSpacing: 0.8, color: t.surface },
  count: { ...Typography.roles.dataSm, color: t.textFaint },
  body: { paddingHorizontal: Gutter, paddingBottom: 4 },

  context: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 11,
    marginTop: 12,
    borderRadius: 13,
    backgroundColor: t.surfaceSunken,
    borderWidth: 1,
    borderColor: t.border,
  },
  contextWarning: { borderColor: t.warningLine, backgroundColor: t.warningSoft },
  contextTile: { width: 26, height: 26, borderRadius: Radius.icon, alignItems: 'center', justifyContent: 'center' },
  contextText: { ...Typography.roles.sub, fontFamily: 'DMSans-SemiBold', fontWeight: '600' as const, color: t.text, flex: 1 },
  contextLabel: { fontFamily: 'DMSans-Bold', fontWeight: '700' as const, fontSize: 8, letterSpacing: 1.1, color: t.textFaint },
  contextDetail: { fontFamily: 'DMSans', fontWeight: '400' as const, color: t.textMuted },

  transition: { flexDirection: 'row', alignItems: 'center', paddingTop: 10, paddingLeft: TIME_WIDTH + 2 },
  transitionNode: {
    width: 19, height: 19, borderRadius: 10, borderWidth: 1.5, borderColor: t.border,
    backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center', zIndex: 1,
  },
  transitionCard: { flex: 1, marginLeft: 10, padding: 10, borderRadius: 13, borderWidth: 1, borderColor: t.border, backgroundColor: t.surfaceSunken },
  transitionTitle: { ...Typography.roles.caps, color: t.textMuted },
  transitionSub: { ...Typography.roles.sub, color: t.textFaint, marginTop: 4 },

  bandHeader: { minHeight: 34, flexDirection: 'row' },
  bandSpan: { width: TIME_WIDTH, paddingTop: 11, paddingRight: 9, textAlign: 'right', ...Typography.roles.dataSm, fontSize: 9, color: t.textDisabled },
  bandLabel: { flex: 1, paddingTop: 10, paddingLeft: 8, ...Typography.roles.caps, fontSize: 8.5, color: t.textFaint },
  spineCol: { width: SPINE_WIDTH, position: 'relative', alignItems: 'center' },
  spineLine: { position: 'absolute', top: 0, bottom: 0, width: 1.5, backgroundColor: t.border },
  bandTick: { marginTop: 13, width: 7, height: 1.5, backgroundColor: t.border },

  entry: { minHeight: 50, flexDirection: 'row' },
  entryPast: { opacity: 0.42 },
  entryTime: { width: TIME_WIDTH, paddingTop: 13, paddingRight: 9, textAlign: 'right', ...Typography.roles.dataSm, color: t.text },
  // The web canvas uses italic for loose time, but no italic native face is bundled. Upright
  // DMSans is the honest fallback until the design system adds one.
  entryTimeLoose: { fontFamily: 'DMSans', fontWeight: '400' as const, color: t.textMuted },
  entryNode: { marginTop: 15, width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, zIndex: 1 },
  entryContent: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 7, paddingLeft: 8 },
  entryTile: { width: 36, height: 36, borderRadius: 11 },
  entryBody: { flex: 1, minWidth: 0 },
  entryTitle: { ...Typography.roles.row, fontSize: 13, lineHeight: 16, color: t.text },
  entryMeta: { ...Typography.roles.sub, color: t.textMuted, marginTop: 1 },

  emptyLine: { minHeight: 44, flexDirection: 'row' },
  emptyTime: { width: TIME_WIDTH },
  emptyNode: { marginTop: 16, width: 11, height: 11, borderRadius: 6, borderWidth: 1.5, borderStyle: 'dashed' as const, borderColor: t.textFaint, backgroundColor: t.surface, zIndex: 1 },
  emptyAction: {
    alignSelf: 'center',
    minHeight: 30,
    marginLeft: 8,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed' as const,
    borderColor: t.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  emptyText: { ...Typography.roles.sub, fontFamily: 'DMSans-SemiBold', fontWeight: '600' as const, color: t.textMuted },
  pressed: { opacity: PRESSED_OPACITY },
}));
