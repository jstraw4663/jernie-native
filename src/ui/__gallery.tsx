// Every primitive, every variant, every state — the Session 3 stage gate.
//
// Reached at `jernie://dev/ui`. Not part of the app: no route links here, and the leading
// underscores keep it out of any barrel. It exists so a change to a primitive can be judged
// against all of its states at once rather than wherever it happens to be used.
//
// Two things to judge here beyond the components themselves, both flagged in
// docs/redesign-plan.md §8:
//   1. `--type-transit` #57518C is provisional. Alternates: #4C4A7A, #5F6B8A.
//   2. `bars` / `sight` / `shopping` are three browns and may not separate in a dense list.
//      The "Ten category colours" section shows them both as swatches and as rows.
import { BedIcon } from 'phosphor-react-native/src/icons/Bed';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { ForkKnifeIcon } from 'phosphor-react-native/src/icons/ForkKnife';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CATEGORY_ICONS, type ItemCategory } from '@/src/design/icons';
import { Core, Gutter, Radius, Spacing, TypeColors, Typography } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import {
  Badge, Button, Chip, GapRow, ImagePlaceholder, ItineraryRow, ListRow,
  Photo, ProgressBar, PromptRow, SegmentedControl, StatStrip, StopCard, Toggle,
} from '@/src/ui';

// A 64x64 teal-to-amber ramp, inlined so the real expo-image path is exercised — cover
// crop, fade-in and radius clipping — without a screen hard-coding a URL, which the
// standing rules forbid. Session 11 supplies real photography.
const SWATCH = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAABRklEQVR4nNXCDUcDAQDH4Z+SlJTes0qWKdP7mymzpJreU2aZlGoqa7fbbbe73TYSkUhEIhKRSESi79fn+D8emiqGdFoqF9JpK6ek01k+l46vfCqdnnJSOn2lE+n4S0fSCZQOpTNYOpBO0NuXzrCXkM6YtyedCS8uneliTDqh4q50Zos70gkXt6UTcTels+CuS2fJXZNO1F2RzqoTlc6GsyydLWdROjvOgnRihXnpxAsR6SQKYensF+akc2jPSufYDkknac9I58yekk4qPymddH5cOmZ+VDpWfkQ6dm5IOm4uKB0vNyidSm5AOpdWQDpXVr90ri2/dG6sPuncZnulc5ftls591iedh2yXdB7NDuk8me3SeTZbpfNiNkvnNdMknbdMo3TeMw3S+cjUS+fTqJPOl1ErnW+jRjo/RrV0ftNV0vlLa/8HxMGw8TyDFPIAAAAASUVORK5CYII=';

const CATEGORIES = Object.keys(CATEGORY_ICONS) as ItemCategory[];

export function Gallery() {
  const [s, t] = useStyles();
  const [chip, setChip] = useState(true);
  const [lens, setLens] = useState('type');
  const [size, setSize] = useState('md');
  const [on, setOn] = useState(true);
  const [stop, setStop] = useState(1);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.h1}>UI gallery</Text>
        <Text style={s.note}>
          Twelve primitives plus the photo seam. The app is pinned to light in
          app.config.js, so dark cannot be checked here yet — every component reads
          useTheme(), but there is no way to see the dark palette until that pin comes off.
        </Text>

        {/* ── Button ─────────────────────────────────────────────── */}
        <Section title="Button" note="One commit action per screen. Never two primaries in one view.">
          <Row label="lg · full">
            <Button label="Add to Itinerary" variant="primary" icon={<PlusIcon size={16} color={t.surface} />} />
          </Row>
          <Row label="variants (md)">
            <View style={s.stack}>
              <Button label="Primary" variant="primary" size="md" />
              <Button label="Secondary" variant="secondary" size="md" />
              <Button label="Ghost" variant="ghost" size="md" />
              <Button label="Accent" variant="accent" size="md" />
              <Button label="Sign in with Apple" variant="dark" size="md" />
            </View>
          </Row>
          <Row label="sm · in a row">
            <View style={s.wrap}>
              <Button label="Add" variant="primary" size="sm" />
              <Button label="Fix" variant="accent" size="sm" />
              <Button label="Book" variant="secondary" size="sm" />
            </View>
          </Row>
          <Row label="disabled (0.5)">
            <View style={s.wrap}>
              <Button label="Primary" variant="primary" size="md" full={false} disabled onPress={() => {}} />
              <Button label="Secondary" variant="secondary" size="md" full={false} disabled onPress={() => {}} />
            </View>
          </Row>
          <Row label="hug width">
            <Button label="Not full width" variant="secondary" size="md" full={false} />
          </Row>
        </Section>

        {/* ── Chip ───────────────────────────────────────────────── */}
        <Section title="Chip" note="Applies immediately. Selection springs — tap to watch the fill, border and label move together.">
          <Row label="filter">
            <View style={s.wrap}>
              <Chip label="Seafood" selected={chip} onPress={() => setChip(v => !v)} />
              <Chip label="Unselected" onPress={() => {}} />
              <Chip label="With icon" icon={<ForkKnifeIcon size={13} color={t.text} />} onPress={() => {}} />
            </View>
          </Row>
          <Row label="solid · dropdown">
            <View style={s.wrap}>
              <Chip label="Solid" variant="solid" onPress={() => {}} />
              <Chip label="Bar Harbor" variant="dropdown" onPress={() => {}} />
              <Chip label="Selected" variant="dropdown" selected onPress={() => {}} />
            </View>
          </Row>
        </Section>

        {/* ── Badge ──────────────────────────────────────────────── */}
        <Section title="Badge" note="Status, never type — the icon says type. Two words maximum.">
          <View style={s.wrap}>
            <Badge label="Booked" tone="accent" />
            <Badge label="Open" tone="warning" />
            <Badge label="Ended" tone="neutral" />
            <Badge label="Today" tone="solid" />
          </View>
        </Section>

        {/* ── ListRow ────────────────────────────────────────────── */}
        <Section title="ListRow" note="default = separate cards · accent = current/secured · plain = dense chronological list.">
          <Row label="default">
            <ListRow
              title="Atlantic Oceanside"
              sub="Bar Harbor · checked in"
              subTone="accent"
              media={<Photo source={SWATCH} style={s.media44} />}
              trailing={<Badge label="Booked" tone="accent" />}
              onPress={() => {}}
            />
          </Row>
          <Row label="accent">
            <ListRow
              title="Jordan Pond House"
              sub="Popovers on the lawn"
              media={<ImagePlaceholder Glyph={ForkKnifeIcon} style={s.media44} />}
              trailing={<CaretRightIcon size={15} color={t.textFaint} />}
              tone="accent"
              onPress={() => {}}
            />
          </Row>
          <Row label="warning subline">
            <ListRow
              title="Southwest Harbor"
              sub="2 nights unbooked"
              subTone="warning"
              media={<ImagePlaceholder Glyph={BedIcon} style={s.media44} />}
              trailing={<Button label="Fix" variant="primary" size="sm" onPress={() => {}} />}
            />
          </Row>
          <Row label="plain (dividers)">
            <View>
              <ListRow title="Notifications" sub="Before something starts" tone="plain" trailing={<Toggle on={on} onChange={setOn} />} />
              <ListRow title="Companions" sub="3 people" tone="plain" trailing={<CaretRightIcon size={15} color={t.textFaint} />} onPress={() => {}} />
              <ListRow title="Sign out" tone="plain" onPress={() => {}} />
            </View>
          </Row>
          <Row label="unbordered · with lead">
            <ListRow
              bordered={false}
              lead={<Text style={s.lead}>08:40</Text>}
              title="No border, mono lead"
              sub="bordered={false}"
            />
          </Row>
        </Section>

        {/* ── ItineraryRow ───────────────────────────────────────── */}
        <Section title="ItineraryRow" note="The fixed 44px mono time column is why an itinerary reads as a timetable.">
          <ItineraryRow
            time="12:10" duration="1h 30m"
            title="Jordan Pond House" sub="Popovers on the lawn · 0.4 mi away"
            photo={<Photo source={SWATCH} style={s.fill} />}
            badge={<Badge label="Next" tone="accent" />}
            now onPress={() => {}}
          />
          <ItineraryRow
            time="15:00"
            title="Cadillac Mountain" sub="Sunset slot not reserved"
            icon={<CATEGORY_ICONS.hike size={18} color={t.textMuted} />}
            badge={<Badge label="Open" tone="warning" />}
            warn onPress={() => {}}
          />
          <ItineraryRow
            time="FRI 22"
            title="Check out" sub="Atlantic Oceanside"
            icon={<BedIcon size={18} color={t.textMuted} />}
          />
        </Section>

        {/* ── GapRow ─────────────────────────────────────────────── */}
        <Section title="GapRow" note="Dashed 1.5px at radius 15 — Android squares the dashes above 15. Check this one on Android.">
          <GapRow
            title="Nowhere to sleep in Southwest Harbor"
            sub="May 27 – 29 · 2 nights unbooked"
            onAction={() => {}}
          />
          <View style={s.gap8} />
          <GapRow
            title="No transport in Southwest Harbor"
            sub="May 27 – 29 · the car drops off first"
            action="Fix"
            onAction={() => {}}
          />
        </Section>

        {/* ── PromptRow ──────────────────────────────────────────── */}
        <Section title="PromptRow" note="An empty state that is also an action. Order by what generates gaps: stay, then transport, then the rest.">
          <PromptRow
            title="Where are you staying?"
            sub="Bar Harbor · 3 nights unbooked"
            action="Add"
            icon={<BedIcon size={18} color={t.warning} />}
            urgent onPress={() => {}}
          />
          <View style={s.gap8} />
          <PromptRow
            title="Anywhere you want to eat?"
            sub="We'll suggest places near your stops"
            action="Add"
            icon={<ForkKnifeIcon size={18} color={t.textMuted} />}
            onPress={() => {}}
          />
          <View style={s.gap8} />
          <PromptRow title="No action pill" sub="action omitted" icon={<PlusIcon size={18} color={t.textMuted} />} onPress={() => {}} />
        </Section>

        {/* ── SegmentedControl ───────────────────────────────────── */}
        <Section title="SegmentedControl" note="The pill springs; the labels do not. Two to four lenses on the SAME data — otherwise they are tabs.">
          <Row label="md · 3">
            <SegmentedControl
              value={lens} onChange={setLens}
              options={[{ value: 'type', label: 'By type' }, { value: 'day', label: 'By day' }, { value: 'stop', label: 'By stop' }]}
            />
          </Row>
          <Row label="sm · 2">
            <SegmentedControl
              size="sm" value={size} onChange={setSize}
              options={[{ value: 'md', label: 'This stop' }, { value: 'lg', label: 'Whole trip' }]}
            />
          </Row>
          <Row label="md · 4">
            <SegmentedControl
              value={lens} onChange={setLens}
              options={[{ value: 'type', label: 'Type' }, { value: 'day', label: 'Day' }, { value: 'stop', label: 'Stop' }, { value: 'all', label: 'All' }]}
            />
          </Row>
        </Section>

        {/* ── ProgressBar ────────────────────────────────────────── */}
        <Section title="ProgressBar" note="Segments in the wizard header; value on the first-run home. Disappears at 100% and never returns.">
          <Row label="segments 2/4"><ProgressBar segments={{ total: 4, done: 2 }} /></Row>
          <Row label="segments 4/4"><ProgressBar segments={{ total: 4, done: 4 }} /></Row>
          <Row label="value 17"><ProgressBar value={17} /></Row>
          <Row label="value 68"><ProgressBar value={68} /></Row>
          <Row label="value 0"><ProgressBar value={0} /></Row>
        </Section>

        {/* ── Toggle ─────────────────────────────────────────────── */}
        <Section title="Toggle" note="Not RN's Switch — that renders the platform control and will not take these colours.">
          <View style={s.wrap}>
            <Toggle on={on} onChange={setOn} accessibilityLabel="Live" />
            <Toggle on onChange={() => {}} accessibilityLabel="On" />
            <Toggle on={false} onChange={() => {}} accessibilityLabel="Off" />
            <Toggle on disabled accessibilityLabel="Disabled on" />
          </View>
        </Section>

        {/* ── StopCard ───────────────────────────────────────────── */}
        <Section title="StopCard" note="292 wide; Session 4's rail snaps at 302. Inactive drops to 62% and loses its ring.">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
            <StopCard
              kicker="Stop 1 of 3" name="Portland" dates="May 21 – 24 · 3 nights"
              status="Everything booked" count="8 plans"
              photo={<Photo source={SWATCH} style={s.fill} />}
              active={stop === 0} onPress={() => setStop(0)}
            />
            <StopCard
              kicker="Stop 2 of 3" name="Bar Harbor" dates="May 24 – 27 · 3 nights"
              status="Checked in" count="11 plans"
              photo={<Photo source={SWATCH} style={s.fill} />}
              active={stop === 1} onPress={() => setStop(1)}
            />
            <StopCard
              kicker="Stop 3 of 3" name="Southwest Harbor" dates="May 27 – 29 · 2 nights"
              status="2 gaps to fix" statusTone="warning" count="3 plans"
              active={stop === 2} onPress={() => setStop(2)}
            />
          </ScrollView>
        </Section>

        {/* ── StatStrip ──────────────────────────────────────────── */}
        <Section title="StatStrip" note="Three or four, never more. The zero state is the one that has to read as intentional.">
          <Row label="on surface">
            <StatStrip stats={[{ value: '14', label: 'Trips' }, { value: '9', label: 'Countries' }, { value: '63', label: 'Nights away' }]} />
          </Row>
          <Row label="zero state">
            <StatStrip stats={[{ value: '0', label: 'Trips' }, { value: '0', label: 'Countries' }, { value: '0', label: 'Nights away' }]} />
          </Row>
          <Row label="on photo">
            <View style={s.onPhoto}>
              <Photo source={SWATCH} style={StyleSheet.absoluteFill} />
              <View style={s.onPhotoInner}>
                <StatStrip onPhoto stats={[{ value: '14', label: 'Trips' }, { value: '9', label: 'Countries' }, { value: '63', label: 'Nights' }]} />
              </View>
            </View>
          </Row>
        </Section>

        {/* ── Photo seam ─────────────────────────────────────────── */}
        <Section title="Photo seam" note="Screens name a subject and get a URL or nothing. Nothing means a placeholder, which is a design surface — not a defect.">
          <Row label="resolved">
            <View style={s.wrap}>
              <Photo source={SWATCH} style={s.media44} />
              <Photo source={SWATCH} style={s.media54} />
              <Photo source={SWATCH} style={s.mediaWide} />
            </View>
          </Row>
          <Row label="unresolved (stops and trips, until Session 11)">
            <View style={s.wrap}>
              <ImagePlaceholder style={s.media44} />
              <ImagePlaceholder Glyph={BedIcon} style={s.media54} glyphSize={22} />
              <ImagePlaceholder Glyph={ForkKnifeIcon} style={s.mediaWide} glyphSize={24} />
            </View>
          </Row>
        </Section>

        {/* ── Type colours ───────────────────────────────────────── */}
        <Section title="Ten category colours" note="--type-transit #57518C is provisional (alternates #4C4A7A, #5F6B8A). bars / sight / shopping are three browns — do they separate below?">
          <View style={s.swatchRow}>
            {CATEGORIES.map(c => (
              <View key={c} style={s.swatchCell}>
                <View style={[s.swatch, { backgroundColor: TypeColors[c] }]} />
                <Text style={s.swatchLabel}>{c}</Text>
              </View>
            ))}
          </View>
          <Text style={s.subNote}>The same ten as icon tiles in a dense list — this is where they have to separate:</Text>
          <View style={s.denseList}>
            {CATEGORIES.map(c => {
              const Glyph = CATEGORY_ICONS[c];
              return (
                <View key={c} style={s.denseRow}>
                  <View style={[s.denseTile, { backgroundColor: TypeColors[c] }]}>
                    <Glyph size={15} color={Core.white} weight="fill" />
                  </View>
                  <Text style={s.denseLabel}>{c}</Text>
                  <Text style={s.denseHex}>{TypeColors[c]}</Text>
                </View>
              );
            })}
          </View>
        </Section>

        <View style={s.tail} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  const [s] = useStyles();
  return (
    <View style={s.section}>
      <Text style={s.h2}>{title}</Text>
      {note ? <Text style={s.note}>{note}</Text> : null}
      <View style={s.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  const [s] = useStyles();
  return (
    <View style={s.labelled}>
      <Text style={s.caps}>{label}</Text>
      {children}
    </View>
  );
}

const useStyles = createThemedStyles((t) => ({
  safe:   { flex: 1, backgroundColor: t.surface },
  scroll: { paddingHorizontal: Gutter, paddingTop: Spacing.base },

  h1:   { ...Typography.roles.screen, color: t.text, marginBottom: Spacing.sm },
  h2:   { ...Typography.roles.section, color: t.text },
  note: { ...Typography.roles.sub, color: t.textMuted, marginTop: 4 },
  subNote: { ...Typography.roles.sub, color: t.textMuted, marginTop: Spacing.base, marginBottom: Spacing.sm },
  caps: { ...Typography.roles.caps, color: t.textFaint, marginBottom: 6 },

  section:     { marginTop: Spacing.xl, borderTopWidth: 1, borderTopColor: t.border, paddingTop: Spacing.base },
  sectionBody: { marginTop: Spacing.md, gap: Spacing.md },
  labelled:    { gap: 0 },

  stack: { gap: Spacing.sm },
  wrap:  { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm },
  gap8:  { height: Spacing.sm },
  rail:  { gap: 10, paddingVertical: Spacing.sm, paddingRight: Gutter },

  media44:   { width: 44, height: 44, borderRadius: Radius.tile },
  media54:   { width: 54, height: 54, borderRadius: 14 },
  mediaWide: { width: 148, height: 108, borderRadius: Radius.tile },
  fill:      { width: '100%', height: '100%' },
  lead:      { ...Typography.roles.data, color: t.textMuted, width: 44 },

  onPhoto:      { height: 96, borderRadius: Radius.row, overflow: 'hidden', justifyContent: 'flex-end' },
  onPhotoInner: { padding: Spacing.md },

  swatchRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  swatchCell:  { width: 62, gap: 5 },
  swatch:      { height: 44, borderRadius: Radius.icon },
  swatchLabel: { ...Typography.roles.sub, color: t.textMuted },

  denseList:  { borderWidth: 1, borderColor: t.border, borderRadius: Radius.row, overflow: 'hidden' },
  denseRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 7, paddingHorizontal: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.borderSoft },
  denseTile:  { width: 26, height: 26, borderRadius: Radius.icon, alignItems: 'center', justifyContent: 'center' },
  denseLabel: { ...Typography.roles.row, color: t.text, flex: 1 },
  denseHex:   { ...Typography.roles.dataSm, color: t.textFaint },

  tail: { height: Spacing.xxxl },
}));
