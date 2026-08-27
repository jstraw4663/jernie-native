import { StyleSheet, useColorScheme } from 'react-native';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';
import { palettes, type Palette, type ThemeName } from './tokens';

/**
 * The active palette.
 *
 * Every component written from Session 3 onward takes its colours from here rather than
 * importing `Core` directly, which is what makes dark mode a config flip instead of a
 * second pass over every screen.
 *
 * Styles that depend on the palette have to be built inside the component:
 *
 *     const t = useTheme();
 *     const s = useMemo(() => StyleSheet.create({
 *       card: { backgroundColor: t.surface, borderColor: t.border },
 *     }), [t]);
 *
 * `StyleSheet.create` at module scope cannot see a hook, which is why the pre-redesign
 * screens still read `Core` statically. Both are correct today: the app is pinned to light
 * in app.config.js, so `Core` and `useTheme()` return the same values. Unpin it only once
 * every visible surface is on the hook.
 */
export function useTheme(): Palette {
  const scheme = useColorScheme();
  return palettes[(scheme ?? 'light') as ThemeName] ?? palettes.light;
}

/** The active theme's name, for the rare branch that needs it (e.g. map style, status bar). */
export function useThemeName(): ThemeName {
  const scheme = useColorScheme();
  return scheme === 'dark' ? 'dark' : 'light';
}

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Builds a component's stylesheet once per palette, not once per instance.
 *
 * `StyleSheet.create` at module scope cannot see a hook, and calling it inside a component
 * allocates a fresh sheet for every mounted row. This keys the result on the palette object
 * itself — there are exactly two, and they are module constants — so every `ListRow` on a
 * screen shares one sheet, the same as if it had been created at module scope.
 *
 *     const useStyles = createThemedStyles((t) => ({
 *       card: { backgroundColor: t.surface, borderColor: t.border },
 *     }));
 *
 *     function Card() {
 *       const [s, t] = useStyles();   // sheet, plus the palette for inline one-offs
 *       return <View style={s.card} />;
 *     }
 *
 * The palette comes back alongside the sheet because colour that varies with a prop
 * (a tone, a selected state) cannot live in a static sheet and has to be applied inline.
 */
export function createThemedStyles<T extends NamedStyles<T>>(factory: (t: Palette) => T) {
  const cache = new WeakMap<Palette, T>();
  return function useStyles(): [T, Palette] {
    const t = useTheme();
    let sheet = cache.get(t);
    if (!sheet) {
      sheet = StyleSheet.create(factory(t));
      cache.set(t, sheet);
    }
    return [sheet, t];
  };
}
