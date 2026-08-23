// A group header on Agenda: an icon tile, the phrase that names the group, a derived
// subline, and a caret that collapses it.
//
// **Custom by decision.** `ListRow` is the closest primitive and is the wrong one: its title
// is `roles.row` (13.5px) and this is `roles.section` (15px), its media tile is 44px and this
// is 30, and it is an *item* in a list where this is the list's heading. Nothing in
// `react-native-mapping.md` covers a section header; every library that does is a
// SectionList wrapper, and the sectioning here is a flat `FlashList` array by design.
// See reference/custom-components.md.
//
// The caret is real: the section collapses. A caret that does nothing is the same dead
// affordance the hero's notification bell was, and this one costs a `useState`.
// Reference: docs/design/Jernie Screen.dc.html, the Agenda tab.
import type { Icon } from 'phosphor-react-native';
import { CaretDownIcon } from 'phosphor-react-native/src/icons/CaretDown';
import { CaretUpIcon } from 'phosphor-react-native/src/icons/CaretUp';
import { Pressable, Text, View } from 'react-native';
import { Gutter, PRESSED_OPACITY, Radius, Spacing, Typography } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { tap } from '@/src/ui';

export interface AgendaSectionProps {
  Glyph: Icon;
  title: string;
  sub: string;
  collapsed: boolean;
  /** Announced, so the control says how much it is hiding. */
  count: number;
  /** The first section sits under the coverage grid and needs no rule above it. */
  first?: boolean;
  onToggle: () => void;
  testID?: string;
}

export function AgendaSection({
  Glyph, title, sub, collapsed, count, first, onToggle, testID,
}: AgendaSectionProps) {
  const [s, t] = useStyles();
  const Caret = collapsed ? CaretDownIcon : CaretUpIcon;

  return (
    <Pressable
      testID={testID}
      // Collapsing is a state change the user commits, so it buzzes — the same rule
      // SegmentedControl and Toggle follow. See src/ui/haptics.ts.
      onPress={() => { tap(); onToggle(); }}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}. ${count} item${count === 1 ? '' : 's'}`}
      accessibilityState={{ expanded: !collapsed }}
      style={({ pressed }) => [s.header, !first && s.ruled, pressed && s.pressed]}
    >
      <View style={s.tile}><Glyph size={16} color={t.textMuted} weight="fill" /></View>

      <View style={s.body}>
        <Text style={s.title} numberOfLines={1}>{title}</Text>
        <Text style={s.sub} numberOfLines={1}>{sub}</Text>
      </View>

      <Caret size={15} color={t.textFaint} weight="regular" />
    </Pressable>
  );
}

const useStyles = createThemedStyles((t) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.rowPad,
    paddingHorizontal: Gutter,
    paddingTop: Spacing.base,
    paddingBottom: 10,
  },
  ruled: { borderTopWidth: 1, borderTopColor: t.borderSoft, marginTop: 14 },

  tile: {
    width: 30, height: 30,
    borderRadius: Radius.icon,
    backgroundColor: t.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },

  body:  { flex: 1, minWidth: 0 },
  title: { ...Typography.roles.section, color: t.text },
  sub:   { ...Typography.roles.sub, color: t.textMuted, marginTop: 4 },

  pressed: { opacity: PRESSED_OPACITY },
}));
