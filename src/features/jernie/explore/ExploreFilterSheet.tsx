// The Explore tab's filter sheet: search text and the must-do toggle, held as a draft until
// Apply commits it. Multi-select needs a commit point — see task-5-brief.md — so this is the
// one place in Session 7 where a change is not immediate.
//
// Provider-free by design, like `ExploreFilterBar` (Task 4): the current `search`/`mustOnly`
// values and a single `onApply` arrive as props rather than `useExploreFilters()`, so the
// sheet stays testable without a provider. `present()` snapshots those props into the draft
// each time it opens, which is also what makes a discarded edit not survive a re-open — the
// next `present()` re-reads the (unchanged) committed props, not the abandoned draft.
//
// `@gorhom/bottom-sheet` config, imperative ref shape, and the two-`Button` footer follow
// `DecisionSheet` — see that file for the rationale.
import React, { useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import {
  BottomSheetBackdrop, BottomSheetModal, BottomSheetTextInput, BottomSheetView, useBottomSheetSpringConfigs,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSheetContext } from '@/src/contexts/SheetContext';
import { Animation, Radius, Spacing, Typography } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { Button, Toggle } from '@/src/ui';

export interface ExploreFilterDraft {
  search: string;
  mustOnly: boolean;
}

const DEFAULT_DRAFT: ExploreFilterDraft = { search: '', mustOnly: false };

export interface ExploreFilterSheetProps {
  /** The committed values — snapshotted into the draft on `present()`. */
  search: string;
  mustOnly: boolean;
  onApply: (next: ExploreFilterDraft) => void;
}

export interface ExploreFilterSheetRef {
  present: () => void;
  dismiss: () => void;
}

export const ExploreFilterSheet = React.forwardRef<ExploreFilterSheetRef, ExploreFilterSheetProps>(
  function ExploreFilterSheet({ search, mustOnly, onApply }, ref) {
    const modalRef = useRef<BottomSheetModal>(null);
    const wasOpen = useRef(false);
    const { increment, decrement } = useSheetContext();
    const [s, t] = useStyles();
    const [draftSearch, setDraftSearch] = useState(search);
    const [draftMustOnly, setDraftMustOnly] = useState(mustOnly);
    const animationConfigs = useBottomSheetSpringConfigs(Animation.springs.drag);

    useImperativeHandle(ref, () => ({
      present() {
        setDraftSearch(search);
        setDraftMustOnly(mustOnly);
        modalRef.current?.present();
      },
      dismiss() { modalRef.current?.dismiss(); },
    }), [search, mustOnly]);

    const handleChange = useCallback((index: number) => {
      if (index >= 0 && !wasOpen.current) {
        wasOpen.current = true;
        increment();
      } else if (index === -1 && wasOpen.current) {
        wasOpen.current = false;
        decrement();
      }
    }, [decrement, increment]);

    const renderBackdrop = useCallback((props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.45}
      />
    ), []);

    const handleClear = useCallback(() => {
      // Clears the draft only. The sheet stays open so the traveller can see what emptied
      // before deciding to Apply — see task-5-brief.md.
      setDraftSearch(DEFAULT_DRAFT.search);
      setDraftMustOnly(DEFAULT_DRAFT.mustOnly);
    }, []);

    const handleApply = useCallback(() => {
      onApply({ search: draftSearch, mustOnly: draftMustOnly });
      modalRef.current?.dismiss();
    }, [draftMustOnly, draftSearch, onApply]);

    return (
      <BottomSheetModal
        ref={modalRef}
        enableDynamicSizing
        backdropComponent={renderBackdrop}
        onChange={handleChange}
        animationConfigs={animationConfigs}
        handleIndicatorStyle={s.handle}
        backgroundStyle={s.background}
      >
        <BottomSheetView style={s.content}>
          <BottomSheetTextInput
            testID="explore-filter-search"
            style={s.input}
            value={draftSearch}
            onChangeText={setDraftSearch}
            placeholder="Search places"
            placeholderTextColor={t.textFaint}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityRole="search"
            accessibilityLabel="Search places"
          />

          <View style={s.toggleRow}>
            <Text style={s.toggleLabel}>Only the must-dos</Text>
            <Toggle
              testID="explore-filter-must-toggle"
              on={draftMustOnly}
              onChange={setDraftMustOnly}
              accessibilityLabel="Only the must-dos"
            />
          </View>

          <View style={s.actions}>
            <View style={s.slot}>
              <Button
                testID="explore-filter-clear"
                label="Clear"
                variant="secondary"
                size="md"
                onPress={handleClear}
              />
            </View>
            <View style={s.slot}>
              <Button
                testID="explore-filter-apply"
                label="Apply"
                variant="accent"
                size="md"
                onPress={handleApply}
              />
            </View>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

ExploreFilterSheet.displayName = 'ExploreFilterSheet';

const useStyles = createThemedStyles(t => ({
  handle: { backgroundColor: t.textFaint, width: 44, height: 5 },
  background: { backgroundColor: t.surface, borderRadius: Radius.sheet },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.base,
  },
  input: {
    ...Typography.roles.body,
    color: t.text,
    backgroundColor: t.surfaceMuted,
    borderRadius: Radius.icon,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { ...Typography.roles.body, color: t.text },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  slot: { flex: 1 },
}));
