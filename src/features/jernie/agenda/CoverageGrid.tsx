// The trip's coverage at a glance: two rows — the two things that can be missing — against
// one column per stop, a teal check or an amber warning in every cell.
//
// **Custom by decision.** Nothing in `react-native-mapping.md` covers a status matrix, and
// the register's rule says name what was rejected: `react-native-table-component` is the
// only maintained option and it renders its own text styles, which will not take these
// tokens for a grid whose entire content is two colours and two glyphs. This is a `View`
// grid. See reference/custom-components.md.
//
// Shown **only when a gap exists** — a wall of green checks is a screen telling you nothing.
// Reference: docs/design/Jernie Screen.dc.html, the Agenda tab.
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { WarningIcon } from 'phosphor-react-native/src/icons/Warning';
import { AirplaneTiltIcon } from 'phosphor-react-native/src/icons/AirplaneTilt';
import { BuildingsIcon } from 'phosphor-react-native/src/icons/Buildings';
import type { StopCoverage, TripCoverage } from '@/src/domain/gaps';
import { Gutter, Radius, Spacing, Typography } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { gapCaption } from './copy';

// Wide enough that "Bar Harbor" sits on one line and "Southwest Harbor" wraps to two rather
// than truncating. Three stops still fit a 393pt phone without scrolling; four do not, which
// is what the horizontal scroll is for.
const COL = 74;
const LABEL_MIN = 88;
const CELL = 21;

/**
 * "Portland, ME" → "Portland". A geocoded stop carries its region in `city`, and in a column
 * this narrow the state is the least useful half of the name — every stop on one trip tends
 * to share it. The full name stays in the accessibility label.
 */
function shortCity(city: string): string {
  const comma = city.indexOf(',');
  return comma > 0 ? city.slice(0, comma).trim() : city;
}

export interface CoverageGridProps {
  coverage: TripCoverage;
  /** Drawn in accent, so you can find where you are without reading. */
  activeStopId?: string | null;
  testID?: string;
}

type Cell = 'covered' | 'short';

const ROWS: { key: 'transport' | 'stay'; label: string; Glyph: typeof CheckIcon }[] = [
  { key: 'transport', label: 'Transport', Glyph: AirplaneTiltIcon },
  { key: 'stay',      label: 'Stays',     Glyph: BuildingsIcon },
];

/** Partial is not covered. Two of three nights booked still leaves a night on a bench. */
function cellOf(stop: StopCoverage, key: 'transport' | 'stay'): Cell {
  return (key === 'stay' ? stop.stay : stop.transport) === 'covered' ? 'covered' : 'short';
}

export function CoverageGrid({ coverage, activeStopId, testID }: CoverageGridProps) {
  const [s, t] = useStyles();
  const { width } = useWindowDimensions();

  // The label column absorbs the slack when the stops fit, exactly as the canvas's `flex:1`
  // does; past that it holds its floor and the whole grid scrolls sideways as one piece.
  // One scroll view, so the header and both rows can never fall out of alignment.
  //
  // The card's own gutters, padding and borders all come off first — measuring against the
  // bare screen width overstates the room by 26px and makes a grid that fits scroll anyway.
  const available = width - Gutter * 2 - Spacing.md * 2 - 2;
  const stopsW = COL * coverage.stops.length;
  const labelW = Math.max(LABEL_MIN, available - stopsW);
  const overflows = labelW + stopsW > available;

  return (
    <View testID={testID} style={s.card}>
      <ScrollView
        horizontal
        // Only when there is somewhere to go. On a three-stop trip the grid fits and a bar
        // under it would be a control for nothing.
        showsHorizontalScrollIndicator={overflows}
        scrollEnabled={overflows}
        // Nothing in here is a tap target, so the whole grid can be a page-turn surface.
        bounces={false}
      >
        <View>
          <View style={[s.row, s.head]}>
            <Text style={[s.caption, { width: labelW }]} numberOfLines={1}>
              {gapCaption(coverage.gaps.length)}
            </Text>
            {coverage.stops.map(stop => (
              <Text
                key={stop.stopId}
                style={[s.stopName, { color: stop.stopId === activeStopId ? t.action : t.textMuted }]}
                numberOfLines={2}
                accessibilityLabel={stop.city}
              >
                {shortCity(stop.city)}
              </Text>
            ))}
          </View>

          {ROWS.map(({ key, label, Glyph }, i) => (
            <View key={key} style={[s.row, i < ROWS.length - 1 && s.divided]}>
              <View style={[s.label, { width: labelW }]}>
                <Glyph size={14} color={t.textMuted} weight="fill" />
                <Text style={s.labelTxt} numberOfLines={1}>{label}</Text>
              </View>

              {coverage.stops.map((stop) => {
                const cell = cellOf(stop, key);
                const ok = cell === 'covered';
                return (
                  <View
                    key={stop.stopId}
                    style={s.cellSlot}
                    accessibilityLabel={`${label} in ${stop.city}: ${ok ? 'covered' : 'a gap'}`}
                  >
                    <View style={[s.cell, { backgroundColor: ok ? t.actionSoft : t.warningSoft }]}>
                      {ok
                        ? <CheckIcon size={10} color={t.action} weight="bold" />
                        : <WarningIcon size={10} color={t.warning} weight="fill" />}
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = createThemedStyles((t) => ({
  card: {
    marginHorizontal: Gutter,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: Radius.row,
    overflow: 'hidden',
  },
  row:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md },
  head:    { backgroundColor: t.surfaceSunken, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: t.borderSoft },
  divided: { borderBottomWidth: 1, borderBottomColor: t.borderSoft },

  caption:  { ...Typography.roles.caps, color: t.textFaint },
  stopName: {
    width: COL,
    // A hair of side padding so two adjacent two-line names never read as one block.
    paddingHorizontal: 3,
    textAlign: 'center',
    fontSize: 9.5, lineHeight: 11,
    fontFamily: 'DMSans-Bold', fontWeight: '700' as const,
  },

  label:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 9 },
  labelTxt: { ...Typography.roles.chip, color: t.text },

  cellSlot: { width: COL, alignItems: 'center', justifyContent: 'center', paddingVertical: 9 },
  cell: {
    width: CELL, height: CELL,
    borderRadius: CELL / 2,
    alignItems: 'center', justifyContent: 'center',
  },
}));
