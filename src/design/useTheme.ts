import { useColorScheme } from 'react-native';
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
