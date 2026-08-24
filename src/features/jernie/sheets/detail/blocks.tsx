// The block library. Twelve components over fifteen keys; a type's layout is a list of
// those keys and nothing more (see `layout.ts`).
//
// **Every block returns `null` when its field is undefined.** That is what lets a type
// declare a block the app cannot fill yet — Amenities, Conditions, Documents, Check-in —
// without anything appearing on screen and without the layout table lying about what the
// type wants. When the data arrives, the block lights up and no layout changes.
//
// Sizes and colours come from the canvas (docs/design/Jernie Screen.dc.html, the open sheet)
// via tokens. Where the canvas did not draw a block — it only ever showed Restaurant down to
// Location — the block follows the nearest primitive it can.
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin';
import { StarIcon } from 'phosphor-react-native/src/icons/Star';
import { FileTextIcon } from 'phosphor-react-native/src/icons/FileText';
import { iconFor } from '@/src/design/icons';
import { PRESSED_OPACITY, Radius, Spacing, Typography } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { Badge, Photo } from '@/src/ui';
import { BlockTitle, InfoList } from './parts';
import type { BlockKey, DetailModel, StatFigure, TimelineStep } from './types';

export interface BlockProps {
  model: DetailModel;
  /** Nearby hands a place id back so the sheet can swap subject without closing. */
  onOpenPlace?: (placeId: string) => void;
}

// ── Stats ────────────────────────────────────────────────────────────────────

/**
 * The figure row: two or three numbers between hairline rules.
 *
 * **Custom by decision.** `StatStrip` is the same idea at a different scale and would be
 * wrong here — it is the Profile passport's 21px figures with no rules and a 22px gap,
 * drawn to be the largest thing on its screen. These are 15px with dividers and sit under a
 * title. The canvas draws both, separately. See reference/custom-components.md.
 */
function Stats({ model }: BlockProps) {
  const [s, t] = useStyles();
  if (!model.stats?.length) return null;

  return (
    <View style={s.stats}>
      {model.stats.map((stat: StatFigure, i) => (
        <View key={stat.label} style={s.statCell}>
          {i > 0 && <View style={s.statRule} />}
          <View>
            <Text style={[s.statValue, stat.accent && { color: t.action }]} numberOfLines={1}>{stat.value}</Text>
            <Text style={s.statLabel} numberOfLines={1}>{stat.label}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Prose ────────────────────────────────────────────────────────────────────

function Prose({ text }: { text?: string }) {
  const [s] = useStyles();
  if (!text) return null;
  return <Text style={s.prose}>{text}</Text>;
}

// ── Chips ────────────────────────────────────────────────────────────────────

/** Tags and amenities are one block with two sources: a wrapped row of inert pills. Not
 *  `ui/Chip`, which is a *control* — it springs on selection and takes an `onPress`. */
function Pills({ title, values }: { title?: string; values?: readonly string[] }) {
  const [s] = useStyles();
  if (!values?.length) return null;

  return (
    <View>
      {title ? <BlockTitle>{title}</BlockTitle> : null}
      <View style={s.pillRow}>
        {values.map(v => (
          <View key={v} style={s.pill}><Text style={s.pillTxt}>{v}</Text></View>
        ))}
      </View>
    </View>
  );
}

// ── Hours ────────────────────────────────────────────────────────────────────

function Hours({ model }: BlockProps) {
  const [s] = useStyles();
  if (!model.hours?.length) return null;

  return (
    <View>
      <BlockTitle>Hours</BlockTitle>
      <View style={s.hours}>
        {model.hours.map(line => (
          <Text key={line} style={s.hoursLine}>{line}</Text>
        ))}
      </View>
    </View>
  );
}

// ── Location ─────────────────────────────────────────────────────────────────

/** The one bordered row the canvas draws verbatim: teal pin tile, where you are, the dates
 *  of the stop it sits in. The trailing "Map" is a label, not a control, until Session 8
 *  builds somewhere for it to go. */
function Location({ model }: BlockProps) {
  const [s, t] = useStyles();
  const loc = model.location;
  if (!loc) return null;

  return (
    <View style={s.locationRow} accessibilityLabel={[loc.title, loc.sub].filter(Boolean).join('. ')}>
      <View style={s.locationTile}><MapPinIcon size={15} color={t.action} weight="fill" /></View>
      <View style={s.locationBody}>
        <Text style={s.locationTitle} numberOfLines={1}>{loc.title}</Text>
        {loc.sub ? <Text style={s.locationSub} numberOfLines={1}>{loc.sub}</Text> : null}
      </View>
    </View>
  );
}

// ── Reviews ──────────────────────────────────────────────────────────────────

/** **Custom by decision.** A horizontal rail of quote cards. Nothing maintained in RN draws
 *  one; this is a `ScrollView` of bordered `View`s. Rewritten in Session 6 onto `useTheme`
 *  and the star glyph — the previous version drew its stars with the ★ character, which is
 *  an emoji on some faces. See reference/custom-components.md. */
function Reviews({ model }: BlockProps) {
  const [s, t] = useStyles();
  if (!model.reviews?.length) return null;

  return (
    <View>
      <BlockTitle>Reviews</BlockTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
        {model.reviews.map((r, i) => (
          <View key={`${r.author}-${i}`} style={s.reviewCard}>
            <View style={s.reviewTop}>
              <Text style={s.reviewName} numberOfLines={1}>{r.author}</Text>
              <View style={s.reviewStars}>
                <StarIcon size={10} color={t.textMuted} weight="fill" />
                <Text style={s.reviewRating}>{r.rating}</Text>
              </View>
            </View>
            <Text style={s.reviewText} numberOfLines={5}>{r.text}</Text>
            <Text style={s.reviewAge}>{timeAgo(r.time)}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function timeAgo(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}


// ── Nearby ───────────────────────────────────────────────────────────────────

/** Titled "Also in {city}" rather than "Nearby": most places carry no coordinates yet, so
 *  the list is genuinely *at this stop* and only sometimes genuinely *near*. The model sorts
 *  by real distance wherever both ends know where they are. */
function Nearby({ model, onOpenPlace }: BlockProps) {
  const [s, t] = useStyles();
  if (!model.nearby?.length) return null;

  const city = model.location?.title.replace(/^Inside /, '');

  return (
    <View>
      <BlockTitle>{city ? `Also in ${city}` : 'Also nearby'}</BlockTitle>
      <View style={s.nearbyList}>
        {model.nearby.map((p, i) => {
          const Glyph = iconFor(p.category);
          return (
            <Pressable
              key={p.id}
              onPress={onOpenPlace ? () => onOpenPlace(p.id) : undefined}
              disabled={!onOpenPlace}
              accessibilityRole={onOpenPlace ? 'button' : undefined}
              accessibilityLabel={p.sub ? `${p.name}. ${p.sub}` : p.name}
              style={({ pressed }) => [s.nearbyRow, i > 0 && s.divided, pressed && onOpenPlace && s.pressed]}
            >
              <Photo source={p.photo} Glyph={Glyph} glyphSize={15} style={s.nearbyThumb} />
              <View style={s.nearbyBody}>
                <Text style={s.nearbyName} numberOfLines={1}>{p.name}</Text>
                {p.sub ? <Text style={s.nearbySub} numberOfLines={1}>{p.sub}</Text> : null}
              </View>
              <Glyph size={14} color={t.textFaint} weight="regular" />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ── Timeline ─────────────────────────────────────────────────────────────────

/**
 * **Custom by decision.** A connected vertical sequence — flight legs, pick-up to drop-off.
 * `react-native-timeline-flatlist` is the only option and has not shipped in four years;
 * `ListRow` has no connector and this is a sequence, not a list. The lead column is DM Mono
 * because the design gives mono to anything that lines up in a column, and it is what makes
 * two legs read as one journey. See reference/custom-components.md.
 */
function Timeline({ model }: BlockProps) {
  const [s, t] = useStyles();
  const steps = model.timeline;
  if (!steps?.length) return null;

  return (
    <View>
      <BlockTitle>Timeline</BlockTitle>
      <View>
        {steps.map((step: TimelineStep, i) => {
          const last = i === steps.length - 1;
          return (
            <View key={`${step.lead}-${step.title}`} style={s.stepRow}>
              <Text style={s.stepLead} numberOfLines={1}>{step.lead}</Text>
              <View style={s.stepSpine}>
                <View style={[s.stepDot, { borderColor: t.action }]} />
                {!last && <View style={s.stepLine} />}
              </View>
              <View style={[s.stepBody, !last && s.stepBodyGap]}>
                <Text style={s.stepTitle} numberOfLines={1}>{step.title}</Text>
                {step.sub ? <Text style={s.stepSub} numberOfLines={2}>{step.sub}</Text> : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Difficulty ───────────────────────────────────────────────────────────────

/** One word, above the figures. It leads the Activity type because it is the thing that
 *  decides whether the rest of the sheet is worth reading. */
function Difficulty({ model }: BlockProps) {
  const [s] = useStyles();
  if (!model.difficulty) return null;
  return (
    <View style={s.hug}>
      <Badge label={model.difficulty} tone="neutral" />
    </View>
  );
}

// ── Documents ────────────────────────────────────────────────────────────────

/** Declared by Travel, dormant everywhere: nothing in the schema stores a boarding pass or
 *  an attachment. Kept so the block exists the day one does. */
function Documents({ model }: BlockProps) {
  const [s, t] = useStyles();
  if (!model.documents?.length) return null;

  return (
    <View>
      <BlockTitle>Documents</BlockTitle>
      <View style={s.docList}>
        {model.documents.map(d => (
          <View key={d.label} style={s.docRow}>
            <FileTextIcon size={15} color={t.textMuted} weight="regular" />
            <Text style={s.docLabel} numberOfLines={1}>{d.label}</Text>
            <Text style={s.docValue} numberOfLines={1}>{d.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Titled info lists ────────────────────────────────────────────────────────

function TitledRows({ title, rows }: { title: string; rows?: DetailModel['booking'] }) {
  if (!rows?.length) return null;
  return (
    <View>
      <BlockTitle>{title}</BlockTitle>
      <InfoList rows={rows} />
    </View>
  );
}

// ── The registry ─────────────────────────────────────────────────────────────

/**
 * Key → component. The only place a block key becomes pixels, which is what keeps
 * `layout.ts` a table of names rather than a switch statement.
 */
export const BLOCKS: Record<BlockKey, (props: BlockProps) => ReactNode> = {
  stats:        Stats,
  description:  ({ model }) => <Prose text={model.description} />,
  conditions:   ({ model }) => <Prose text={model.conditions} />,
  tags:         ({ model }) => <Pills values={model.tags} />,
  amenities:    ({ model }) => <Pills title="Amenities" values={model.amenities} />,
  hours:        Hours,
  location:     Location,
  reviews:      Reviews,
  nearby:       Nearby,
  timeline:     Timeline,
  difficulty:   Difficulty,
  documents:    Documents,
  booking:      ({ model }) => <TitledRows title="Booking" rows={model.booking} />,
  checkin:      ({ model }) => <TitledRows title="Check-in" rows={model.checkin} />,
  confirmation: ({ model }) => <TitledRows title="Confirmation" rows={model.confirmation} />,
};

const useStyles = createThemedStyles((t) => ({
  pressed: { opacity: PRESSED_OPACITY },
  /** A badge stretches to its parent unless something stops it. */
  hug:     { alignSelf: 'flex-start' },

  // Stats — 15px figures between hairline rules, per the canvas.
  stats:      { flexDirection: 'row', paddingVertical: Spacing.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: t.borderSoft },
  statCell:   { flexDirection: 'row', alignItems: 'center' },
  statRule:   { width: 1, alignSelf: 'stretch', backgroundColor: t.borderSoft, marginHorizontal: Spacing.base },
  statValue:  { fontSize: 15, lineHeight: 15, fontFamily: 'DMSans-Bold', fontWeight: '700' as const, color: t.text },
  statLabel:  { fontSize: 10, lineHeight: 10, fontFamily: 'DMSans', color: t.textFaint, marginTop: 5 },

  prose:      { ...Typography.roles.body, lineHeight: 21.5, color: t.textMuted },

  pillRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  pill:       { height: 28, paddingHorizontal: 11, borderRadius: 14, backgroundColor: t.surfaceMuted, justifyContent: 'center' },
  pillTxt:    { fontSize: 11.5, lineHeight: 12, fontFamily: 'DMSans-SemiBold', fontWeight: '600' as const, color: t.textMuted },

  hours:      { gap: 5 },
  hoursLine:  { fontSize: 12.5, lineHeight: 16, fontFamily: 'DMSans', color: t.textMuted },

  locationRow:   { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 11, borderWidth: 1, borderColor: t.border, borderRadius: 14 },
  locationTile:  { width: 30, height: 30, borderRadius: 9, backgroundColor: t.actionSoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  locationBody:  { flex: 1, minWidth: 0 },
  locationTitle: { fontSize: 12.5, lineHeight: 15, fontFamily: 'DMSans-SemiBold', fontWeight: '600' as const, color: t.text },
  locationSub:   { fontSize: 10.5, lineHeight: 13, fontFamily: 'DMSans', color: t.textMuted, marginTop: 2 },

  rail:        { gap: Spacing.sm, paddingRight: Spacing.xs },
  reviewCard:  { width: 244, padding: Spacing.md, borderWidth: 1, borderColor: t.border, borderRadius: 14 },
  reviewTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, marginBottom: 7 },
  reviewName:  { flex: 1, fontSize: 12, lineHeight: 14, fontFamily: 'DMSans-Bold', fontWeight: '700' as const, color: t.text },
  reviewStars: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  reviewRating:{ ...Typography.roles.dataSm, color: t.textMuted },
  reviewText:  { fontSize: 12, lineHeight: 17, fontFamily: 'DMSans', color: t.textMuted },
  reviewAge:   { fontSize: 10, lineHeight: 12, fontFamily: 'DMSans', color: t.textFaint, marginTop: 7 },


  nearbyList:  { borderWidth: 1, borderColor: t.border, borderRadius: 14, overflow: 'hidden' },
  nearbyRow:   { flexDirection: 'row', alignItems: 'center', gap: 11, padding: Spacing.sm },
  divided:     { borderTopWidth: 1, borderTopColor: t.borderSoft },
  nearbyThumb: { width: 40, height: 40, borderRadius: Radius.icon },
  nearbyBody:  { flex: 1, minWidth: 0 },
  nearbyName:  { fontSize: 12.5, lineHeight: 15, fontFamily: 'DMSans-SemiBold', fontWeight: '600' as const, color: t.text },
  nearbySub:   { fontSize: 10.5, lineHeight: 13, fontFamily: 'DMSans', color: t.textMuted, marginTop: 2 },

  stepRow:     { flexDirection: 'row', alignItems: 'stretch' },
  stepLead:    { ...Typography.roles.data, color: t.textMuted, width: 46, paddingTop: 3, textAlign: 'right' as const },
  stepSpine:   { width: 22, alignItems: 'center' },
  stepDot:     { width: 9, height: 9, borderRadius: 4.5, borderWidth: 2, marginTop: 3 },
  stepLine:    { flex: 1, width: 1, backgroundColor: t.border, marginTop: 3 },
  stepBody:    { flex: 1, minWidth: 0 },
  stepBodyGap: { paddingBottom: Spacing.md },
  stepTitle:   { fontSize: 12.5, lineHeight: 15, fontFamily: 'DMSans-SemiBold', fontWeight: '600' as const, color: t.text },
  stepSub:     { fontSize: 10.5, lineHeight: 14, fontFamily: 'DMSans', color: t.textMuted, marginTop: 2 },

  docList:     { borderWidth: 1, borderColor: t.border, borderRadius: 14, overflow: 'hidden' },
  docRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 10 },
  docLabel:    { flex: 1, fontSize: 12.5, lineHeight: 16, fontFamily: 'DMSans-SemiBold', fontWeight: '600' as const, color: t.text },
  docValue:    { ...Typography.roles.dataSm, color: t.textMuted },
}));
