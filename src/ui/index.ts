// The design system's primitives. Twelve components from
// `.claude/skills/jernie-design/components/{core,travel}/`, plus the photo seam.
//
// Every one takes its colours from `useTheme()` rather than the static `Core` export, which
// is what makes dark mode a config flip instead of a second pass. Screens written from
// Session 3 onward import from here and re-implement none of it.
//
// A barrel is safe here in a way it is not for `phosphor-react-native`: this is first-party
// code, thirteen small modules, and Metro's inability to tree-shake a barrel only matters
// when the barrel is 500KB of icons.

export { Badge, type BadgeProps, type BadgeTone } from './Badge';
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './Button';
export { Chip, type ChipProps, type ChipVariant } from './Chip';
export { ChipDropdown, type ChipDropdownProps, type DropdownOption } from './ChipDropdown';
export { GapRow, type GapRowProps } from './GapRow';
export { ImagePlaceholder, Photo, type PhotoProps } from './Photo';
export { ItineraryRow, type ItineraryRowProps } from './ItineraryRow';
export { ListRow, type ListRowProps, type ListRowSubTone, type ListRowTone } from './ListRow';
export { ProgressBar, type ProgressBarProps } from './ProgressBar';
export { PromptRow, type PromptRowProps } from './PromptRow';
export { SegmentedControl, type SegmentedControlProps, type SegmentedOption } from './SegmentedControl';
export { StatStrip, type Stat, type StatStripProps } from './StatStrip';
export { STOP_CARD_GAP, STOP_CARD_HEIGHT, STOP_CARD_METRICS, STOP_CARD_RATIO, StopCard, stopCardWidth, type StopCardProps } from './StopCard';
export { Toggle, type ToggleProps } from './Toggle';
export { tap } from './haptics';
