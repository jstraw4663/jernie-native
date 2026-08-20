import { Alert } from 'react-native';

export interface ConfirmDeleteOptions {
  title: string;
  message: string;
  /** Defaults to "Remove". Use a more specific verb where it reads better, e.g. "Delete trip". */
  confirmLabel?: string;
  onConfirm: () => void;
}

/**
 * The single confirmation gate for every destructive action in the app (remove stop,
 * booking, itinerary item, trip). Cancel is first and is the safe default; the confirm
 * button is styled `destructive` so the platform renders it in red.
 */
export function confirmDelete({ title, message, confirmLabel = 'Remove', onConfirm }: ConfirmDeleteOptions): void {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
