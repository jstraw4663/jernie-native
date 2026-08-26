// A bubble that always has a value — the stop switch, the type filter, the sort control.
// Tap opens an inline dropdown anchored under the bubble; selection applies immediately,
// no Apply button. Custom by decision: see reference/custom-components.md.
// Reference: docs/superpowers/sdd/2026-08-26-explore/task-2-brief.md
import { useRef, useState, type ReactNode } from 'react';
import {
  Modal, Pressable, ScrollView, Text, View, useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { Animation, Gutter, Layout, PRESSED_OPACITY, Radius, Shadow, Spacing, Typography } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { Chip } from './Chip';
import { tap } from './haptics';

export interface DropdownOption {
  id: string;
  label: string;
  icon?: ReactNode;
}

export interface ChipDropdownProps {
  /** The chip's own text — already resolved by the caller ("All stops", "All types"). */
  label: string;
  options: DropdownOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Leading icon inside the chip. */
  icon?: ReactNode;
  /** Options get `${testID}-option-${id}`. */
  testID?: string;
}

interface AnchorFrame { x: number; y: number; width: number; height: number; }

// The card's own literal geometry, named directly by the brief rather than drawn from the
// spacing scale — a 180/320 box is this component's own contract, not a reused role.
const CARD_MIN_WIDTH = 180;
const CARD_MAX_HEIGHT = 320;

// Breathing room between the trigger and the card, in whichever direction it opens. Not a
// role token (nothing in `Spacing` names "gap to an anchored menu") — the closest step on
// the 4px scale below the padding tokens.
const ANCHOR_GAP = Spacing.xs;

// The 34px chip is well under the 44px tap-target floor. Same call `Toggle` makes.
const HIT_SLOP = { top: 5, bottom: 5, left: 5, right: 5 };

export function ChipDropdown({ label, options, selectedId, onSelect, icon, testID }: ChipDropdownProps) {
  const [s, t] = useStyles();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const triggerRef = useRef<View>(null);

  const [frame, setFrame] = useState<AnchorFrame | null>(null);
  const [flip, setFlip] = useState(false);
  const open = frame !== null;

  // `spring-gentle` — the same spring `Chip` uses for its own selection fill, so the bubble
  // and the menu it opens read as one object moving together.
  const progress = useSharedValue(0);
  const entry = useAnimatedStyle(() => ({
    opacity: progress.value,
    // The menu grows out of the trigger: it starts closer to it and settles outward by 4px —
    // down when it opens below, up when flipped above.
    transform: [{ translateY: (1 - progress.value) * (flip ? 4 : -4) }],
  }));

  // A no-op layout listener. On some Android versions `measureInWindow` never resolves for a
  // view that has never fired a layout event of its own — this registers one so the later,
  // interaction-time `measureInWindow` call is reliable.
  const handleLayout = (_event: LayoutChangeEvent) => {};

  const handleOpen = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const estimatedHeight = Math.min(CARD_MAX_HEIGHT, options.length * Layout.tapMin);
      const spaceBelow = windowHeight - insets.bottom - (y + height + ANCHOR_GAP);
      setFrame({ x, y, width, height });
      setFlip(spaceBelow < estimatedHeight);
      progress.value = 0;
      progress.value = withSpring(1, Animation.springs.gentle);
    });
  };

  const handleClose = () => setFrame(null);

  const handleSelect = (id: string) => {
    tap();
    onSelect(id);
    handleClose();
  };

  const cardPosition = frame
    ? flip
      ? { left: frame.x, bottom: windowHeight - frame.y + ANCHOR_GAP }
      : { left: frame.x, top: frame.y + frame.height + ANCHOR_GAP }
    : undefined;

  return (
    <>
      {/* Chip renders the bubble; it gets no `onPress` so it stays purely presentational and
          this Pressable — which needs the hitSlop the 34px chip doesn't have room for — is
          the sole touch and accessibility owner. */}
      <Pressable
        ref={triggerRef}
        onLayout={handleLayout}
        onPress={handleOpen}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        testID={testID}
        style={({ pressed }) => (pressed ? s.pressed : undefined)}
      >
        <Chip label={label} icon={icon} variant="dropdown" />
      </Pressable>

      <Modal visible={open} transparent animationType="none" onRequestClose={handleClose} statusBarTranslucent>
        {frame ? (
          <View style={s.root}>
            <Pressable style={s.backdrop} onPress={handleClose} accessible={false} />
            <Animated.View style={[s.card, cardPosition, entry]} accessibilityViewIsModal>
              <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
                {options.map((option) => {
                  const selected = option.id === selectedId;
                  return (
                    <Pressable
                      key={option.id}
                      testID={testID ? `${testID}-option-${option.id}` : undefined}
                      onPress={() => handleSelect(option.id)}
                      accessibilityRole="menuitem"
                      accessibilityLabel={option.label}
                      accessibilityState={{ selected }}
                      style={({ pressed }) => [s.option, pressed && s.pressed]}
                    >
                      {option.icon ? <View style={s.optionIcon}>{option.icon}</View> : null}
                      <Text
                        style={[s.optionLabel, selected && s.optionLabelSelected]}
                        numberOfLines={1}
                      >
                        {option.label}
                      </Text>
                      {selected ? (
                        <View style={s.optionCheck}>
                          <CheckIcon size={14} color={t.action} weight="bold" />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Animated.View>
          </View>
        ) : null}
      </Modal>
    </>
  );
}

const useStyles = createThemedStyles((t) => ({
  root: { flex: 1 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  card: {
    position: 'absolute',
    backgroundColor: t.surface,
    borderRadius: Radius.row,
    minWidth: CARD_MIN_WIDTH,
    maxHeight: CARD_MAX_HEIGHT,
    ...Shadow.float,
  },
  // A shadow, not a border — a card never carries both. The radius has to be repeated here
  // (with `overflow: hidden`) because the shadow on `card` needs its own box left unclipped.
  scroll: { borderRadius: Radius.row, maxHeight: CARD_MAX_HEIGHT, overflow: 'hidden' },
  option: {
    height: Layout.tapMin,
    paddingHorizontal: Gutter,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  optionIcon: { alignItems: 'center', justifyContent: 'center' },
  optionLabel: { ...Typography.roles.body, color: t.text, flex: 1 },
  // Accent ink, not a fill — a 9% `actionSoft` wash inside a floating card would read as a
  // hover state, and this is a phone.
  optionLabelSelected: { color: t.action },
  optionCheck: { marginLeft: Spacing.sm },
  pressed: { opacity: PRESSED_OPACITY },
}));
