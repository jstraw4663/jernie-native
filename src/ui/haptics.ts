// The one haptic in the system.
//
// The design's press rule is "opacity 0.85 plus a light haptic" — one impact style, never a
// heavier one, never a notification or selection pattern. Everything routes through here so
// there is a single place to silence it (an accessibility setting, a test) and a single
// place to change it.
//
// **Which primitives fire it.** Committing ones: `Button`, `Chip`, `Toggle`,
// `SegmentedControl`, `StopCard`, and the action pills inside `GapRow` and `PromptRow`.
// Navigation ones do not — `ListRow` and `ItineraryRow` bodies open a sheet or push a
// screen, and a buzz on every tap through a list turns the signal into noise. That split
// follows `reference/react-native-mapping.md`: "haptics on commit actions".
//
// **`StopCard` is the exception that proves the rule** — it does NOT buzz on press, and it
// is the only pressable primitive that does not. Pressing one does not *do* anything; it
// selects, and the same selection arrives three other ways (rail swipe, rail dot, pinned-bar
// dot). Whoever owns the *selection* fires the single buzz — `handleSelectStop` on the home
// screen. The mapping names "stop change" as one Light impact, not one per component that
// noticed the change, and a tap chains through two of those components.
//
// The general rule this comes from: when several paths converge on one state change, the
// haptic belongs at the convergence, not on the way in.
import * as Haptics from 'expo-haptics';

/** Light impact on a committing press. Fire-and-forget — a rejected promise is not an error
 *  worth surfacing, and on a device with haptics turned off this is a no-op in the OS. */
export function tap(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
