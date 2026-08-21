import React, { useCallback, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView, useBottomSheetSpringConfigs } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSheetContext } from '@/src/contexts/SheetContext';
import { submitFeedback, TITLE_MAX_LENGTH } from '@/src/lib/feedbackWrites';
import { Core, Semantic, Typography, Radius, Spacing } from '@/src/design/tokens';
import type { BugPriority } from '@/src/types';

export type FeedbackSheetRef = {
  present: () => void;
  dismiss: () => void;
};

interface FeedbackSheetProps {
  tripId: string;
}

const SHEET_SPRING = {
  damping: 60,
  stiffness: 180,
  mass: 1.2,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
} as Parameters<typeof useBottomSheetSpringConfigs>[0];

const PRIORITIES: { id: BugPriority; label: string; color: string }[] = [
  { id: 'low',    label: 'Minor',    color: Core.textMuted },
  { id: 'medium', label: 'Annoying', color: Semantic.warning },
  { id: 'high',   label: 'Blocking', color: Semantic.error },
];

/**
 * Bug report composer. Writes create-only to `bug_reports` — see `src/lib/feedbackWrites.ts`.
 *
 * The title cap comes from TITLE_MAX_LENGTH rather than a literal, so this input and the
 * server's .validate rule cannot drift into a state where the sheet accepts what RTDB refuses.
 */
export const FeedbackSheet = React.forwardRef<FeedbackSheetRef, FeedbackSheetProps>(({ tripId }, ref) => {
  const modalRef = useRef<BottomSheetModal>(null);
  const { increment, decrement } = useSheetContext();
  const wasOpen = useRef(false);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<BugPriority>('medium');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const animationConfigs = useBottomSheetSpringConfigs(SHEET_SPRING);

  const reset = useCallback(() => {
    setTitle('');
    setBody('');
    setPriority('medium');
    setError(null);
    setSending(false);
    setSent(false);
  }, []);

  useImperativeHandle(ref, () => ({
    present() {
      reset();
      modalRef.current?.present();
    },
    dismiss() { modalRef.current?.dismiss(); },
  }));

  const handleChange = useCallback((index: number) => {
    if (index >= 0 && !wasOpen.current) {
      wasOpen.current = true;
      increment();
    } else if (index === -1 && wasOpen.current) {
      wasOpen.current = false;
      decrement();
    }
  }, [increment, decrement]);

  const renderBackdrop = useCallback((props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" opacity={0.45} />
  ), []);

  const handleSend = useCallback(async () => {
    setSending(true);
    setError(null);
    try {
      await submitFeedback({ tripId, title, body: body || undefined, priority });
      // Confirm before dismissing. A report vanishing on send looks identical to a report
      // that failed to send, and the user has no other way to check.
      setSent(true);
      setTimeout(() => modalRef.current?.dismiss(), 900);
    } catch (e) {
      // The sheet stays open with the text intact — losing a typed-up bug report to a
      // transient network failure is the one outcome this flow must not have.
      setError(e instanceof Error ? e.message : "Couldn't send that. Try again.");
      setSending(false);
    }
  }, [tripId, title, body, priority]);

  const canSend = title.trim().length > 0 && !sending;

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
      <BottomSheetScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Send feedback</Text>
        <Text style={s.subtitle}>
          Goes straight to the developer with your build number attached.
        </Text>

        {sent ? (
          <Text testID="feedback-sent" style={s.sent}>Thanks — sent.</Text>
        ) : (
          <>
            <Text style={s.label}>What happened?</Text>
            <TextInput
              testID="feedback-title"
              style={s.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Hero gradient flickers on scroll"
              placeholderTextColor={Core.textFaint}
              maxLength={TITLE_MAX_LENGTH}
              editable={!sending}
            />

            <Text style={s.label}>More detail (optional)</Text>
            <TextInput
              testID="feedback-body"
              style={[s.input, s.multiline]}
              value={body}
              onChangeText={setBody}
              placeholder="Only on the Bar Harbor stop, and only after switching tabs."
              placeholderTextColor={Core.textFaint}
              multiline
              maxLength={4000}
              editable={!sending}
            />

            <Text style={s.label}>How bad is it?</Text>
            <View style={s.priorityRow}>
              {PRIORITIES.map(p => {
                const active = p.id === priority;
                return (
                  <TouchableOpacity
                    key={p.id}
                    testID={`feedback-priority-${p.id}`}
                    onPress={() => setPriority(p.id)}
                    disabled={sending}
                    style={[
                      s.priorityPill,
                      active && { backgroundColor: `${p.color}1F`, borderColor: p.color },
                    ]}
                  >
                    <Text style={[s.priorityText, active && { color: p.color }]}>{p.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {error ? <Text testID="feedback-error" style={s.error}>{error}</Text> : null}

            <TouchableOpacity
              testID="feedback-send"
              disabled={!canSend}
              style={[s.sendButton, !canSend && s.sendButtonDisabled]}
              onPress={() => { void handleSend(); }}
            >
              <Text style={s.sendButtonText}>{sending ? 'Sending…' : 'Send'}</Text>
            </TouchableOpacity>
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

FeedbackSheet.displayName = 'FeedbackSheet';

const s = StyleSheet.create({
  handle:     { backgroundColor: Core.textFaint, width: 44, height: 5 },
  background: { backgroundColor: Core.bg, borderRadius: 24 },
  content:    { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.sm },
  title:      { ...Typography.roles.h2, color: Core.text },
  subtitle:   { ...Typography.roles.meta, color: Core.textMuted, marginBottom: Spacing.sm },
  label:      { ...Typography.roles.label, color: Core.textMuted, marginTop: Spacing.sm },
  input: {
    ...Typography.roles.body,
    color: Core.text,
    backgroundColor: Core.surface,
    borderWidth: 1,
    borderColor: Core.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  multiline:  { minHeight: 88, textAlignVertical: 'top' },
  priorityRow: { flexDirection: 'row', gap: Spacing.sm },
  priorityPill: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Core.border,
    borderRadius: Radius.full,
    paddingVertical: Spacing.sm,
  },
  priorityText: { ...Typography.roles.label, color: Core.textMuted },
  error:      { ...Typography.roles.meta, color: Semantic.error, marginTop: Spacing.xs },
  sent:       { ...Typography.roles.body, color: Semantic.success, paddingVertical: Spacing.xl, textAlign: 'center' },
  sendButton: {
    marginTop: Spacing.base,
    backgroundColor: Core.action,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  sendButtonDisabled: { opacity: 0.45 },
  sendButtonText: { ...Typography.roles.button, color: Core.textInverse },
});
