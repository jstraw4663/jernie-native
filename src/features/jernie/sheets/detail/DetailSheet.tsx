// One shell, four types, one block library.
//
// **Custom by decision.** `@gorhom/bottom-sheet` v5 owns everything a sheet library should:
// the modal, the detents, the drag, the backdrop and the scroll view. What is ours is the
// *template* inside it — hero, title, an ordered run of blocks, one footer action — and
// nothing in `react-native-mapping.md` covers that. It replaces `EntityDetailSheet` plus six
// per-type sheets. See reference/custom-components.md.
//
// The shell owns detents, hero, title and the footer. It knows nothing about restaurants or
// flights: it reads `model.blocks` and renders them in order. Adding a type is an entry in
// `BLOCK_ORDER`, which is the claim this session exists to make true.
// Reference: docs/design/Jernie Spec.dc.html "Detail sheet"; the open sheet in Jernie Screen.
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { PencilSimpleIcon } from 'phosphor-react-native/src/icons/PencilSimple';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { ShareNetworkIcon } from 'phosphor-react-native/src/icons/ShareNetwork';
import React, { useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import { useSheetContext } from '@/src/contexts/SheetContext';
import { Animation, Gutter, PRESSED_OPACITY, Radius, Spacing } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { Button } from '@/src/ui';
import { BLOCKS } from './blocks';
import { DetailHero } from './DetailHero';
import { buildDetailModel } from './model';
import type { DetailPayload } from './types';

export type DetailSheetRef = {
  present: (payload: DetailPayload) => void;
  dismiss: () => void;
};

// Session 6's explicit contract: peek, medium and near-full. A row press opens at medium;
// peek remains available when the traveller drags the sheet down without dismissing it.
const SNAP_POINTS = ['15%', '55%', '92%'];

const FOOTER_ICONS = {
  plus:   PlusIcon,
  check:  CheckIcon,
  pencil: PencilSimpleIcon,
} as const;

export const DetailSheet = React.forwardRef<DetailSheetRef, object>((_, ref) => {
  const [s, t] = useStyles();
  const modalRef = useRef<BottomSheetModal>(null);
  const scrollRef = useRef<React.ComponentRef<typeof BottomSheetScrollView>>(null);
  const [payload, setPayload] = useState<DetailPayload | null>(null);
  const { increment, decrement } = useSheetContext();
  const wasOpen = useRef(false);

  useImperativeHandle(ref, () => ({
    present(p: DetailPayload) {
      setPayload(p);
      modalRef.current?.present();
    },
    dismiss() {
      modalRef.current?.dismiss();
    },
  }));

  const handleClose = useCallback(() => { modalRef.current?.dismiss(); }, []);

  const handleChange = useCallback((index: number) => {
    if (index >= 0 && !wasOpen.current) {
      wasOpen.current = true;
      increment();
    } else if (index === -1 && wasOpen.current) {
      wasOpen.current = false;
      decrement();
    }
  }, [increment, decrement]);

  // Nearby swaps the subject in place rather than closing and reopening — the stop, the
  // place list and the enrichment map are all already here, so the sheet only has to point
  // at a different place. Scroll goes back to the top, because the offset means nothing
  // against different content.
  const openPlace = useCallback((placeId: string) => {
    setPayload(prev => {
      const place = prev?.places?.find(p => p.id === placeId);
      if (!prev || !place) return prev;
      return { ...prev, subject: { kind: 'place', place }, isAdded: undefined, onAdd: undefined };
    });
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const model = useMemo(() => (payload ? buildDetailModel(payload) : null), [payload]);

  const onShare = useCallback(() => {
    if (model) void Share.share({ message: model.shareText });
  }, [model]);

  const renderBackdrop = useCallback((props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" opacity={0.5} />
  ), []);

  const FooterIcon = model?.footer?.icon ? FOOTER_ICONS[model.footer.icon] : undefined;

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={SNAP_POINTS}
      index={1}
      enableOverDrag={false}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      onChange={handleChange}
      // The grabber is drawn inside the hero, over the photograph. Left to gorhom it would
      // sit on a white strip above it — see DetailHero.
      handleComponent={null}
      animationConfigs={Animation.springs.drag}
      backgroundStyle={s.background}
    >
      {model ? (
        <>
          <DetailHero hero={model.hero} title={model.title} onClose={handleClose} />

          <BottomSheetScrollView
            ref={scrollRef}
            contentContainerStyle={s.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={s.titleBlock}>
              <Text style={s.title}>{model.title}</Text>
              {model.sub ? <Text style={s.sub} numberOfLines={2}>{model.sub}</Text> : null}
            </View>

            {model.blocks.map(key => {
              const Block = BLOCKS[key];
              return <Block key={key} model={model} onOpenPlace={openPlace} />;
            })}
          </BottomSheetScrollView>

          {model.footer ? (
            <View style={s.footer}>
              <Pressable
                onPress={onShare}
                accessibilityRole="button"
                accessibilityLabel="Share"
                style={({ pressed }) => [s.share, pressed && s.pressed]}
              >
                <ShareNetworkIcon size={18} color={t.text} weight="regular" />
              </Pressable>
              <View style={s.footerAction}>
                <Button
                  label={model.footer.label}
                  onPress={model.footer.onPress}
                  icon={FooterIcon ? <FooterIcon size={15} color={t.surface} weight="fill" /> : undefined}
                  testID="detail-footer-action"
                />
              </View>
            </View>
          ) : null}
        </>
      ) : null}
    </BottomSheetModal>
  );
});

DetailSheet.displayName = 'DetailSheet';

const useStyles = createThemedStyles((t) => ({
  background: { backgroundColor: t.surface, borderTopLeftRadius: Radius.sheet, borderTopRightRadius: Radius.sheet },

  // Blocks are separated by one gap rather than each carrying its own margin, so a dormant
  // block leaves no hole when it renders null.
  content: { paddingHorizontal: Gutter, paddingTop: Spacing.base, paddingBottom: Spacing.xl, gap: Spacing.base },

  titleBlock: { gap: 7 },
  title: { fontSize: 23, lineHeight: 26, fontFamily: 'Fraunces', fontWeight: '400' as const, color: t.text },
  sub:   { fontSize: 12, lineHeight: 16, fontFamily: 'DMSans', color: t.textMuted },

  footer: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Gutter, paddingTop: Spacing.md, paddingBottom: 26,
    borderTopWidth: 1, borderTopColor: t.border,
    backgroundColor: t.surface,
  },
  footerAction: { flex: 1 },
  // 52, not the canvas's 48: `Button` at `lg` is 52 and the two sit side by side. Matching
  // the primitive beats matching the mock by 4px when the mock's own footer is one row.
  share: {
    width: 52, height: 52, borderRadius: 13,
    borderWidth: 1, borderColor: t.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  pressed: { opacity: PRESSED_OPACITY },
}));
