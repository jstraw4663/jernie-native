import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { geocodeCity } from '@/src/lib/geocodeClient';
import { Core, Semantic, Typography, Radius, Spacing } from '@/src/design/tokens';

export interface ResolvedStop {
  city: string;
  region: string;
  lat: number;
  lon: number;
  dates: { start: string; end: string };
}

export interface StopFormProps {
  /**
   * Called with the fully-resolved stop once the form's own submit action is pressed. Only ever
   * fires once the Continue button is enabled (successful geocode + both dates present) — the
   * caller doesn't need to re-validate anything.
   *
   * May return void (e.g. the wizard writing into local draft state, Task 5) or a Promise (e.g.
   * an RTDB write) — if it returns a Promise, the form disables Continue and shows a spinner
   * until it settles, and shows an inline error (distinct from a geocode error) if it rejects,
   * without losing the already-resolved geocode/dates so the user can just retry.
   */
  onSubmit: (stop: ResolvedStop) => void | Promise<void>;
  /** Optional — shows a "Cancel" affordance when provided (e.g. dismissing a hosting modal). */
  onCancel?: () => void;
  /** Label for the submit button. Defaults to "Continue". */
  submitLabel?: string;
}

type GeocodeStatus = 'idle' | 'loading' | 'success' | 'error';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const [year, month, day] = s.split('-').map(Number);
  // `Date` silently rolls invalid y/m/d over into the next valid date instead of throwing
  // (e.g. `new Date(2026, 1, 30)` becomes March 2nd) — round-trip through the parsed fields to
  // catch calendar-invalid-but-regex-shaped input like "2026-02-30" or "2026-13-01".
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/**
 * Shared, reusable stop-entry form: a city text field plus start/end date fields, both required.
 * Geocodes the typed city via `geocodeCity()` on demand (the "Find city" button) and blocks the
 * Continue action until that geocode has succeeded AND both dates are present — there is no
 * "continue anyway without coordinates" path. Not tied to any one screen: the Add Stop bottom
 * sheet and the onboarding wizard's first-stop step both render this directly and just supply a
 * different `onSubmit`.
 */
export function StopForm({ onSubmit, onCancel, submitLabel = 'Continue' }: StopFormProps) {
  const [city, setCity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [geocodeStatus, setGeocodeStatus] = useState<GeocodeStatus>('idle');
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  // The resolved lat/lon/city/region from the last SUCCESSFUL geocode, plus the exact city text
  // that was resolved — if `city` drifts from `resolvedFor` (the user edits the field after a
  // successful lookup), the resolution is stale and must not be trusted for submission anymore.
  const [resolved, setResolved] = useState<{ city: string; region: string; lat: number; lon: number } | null>(null);
  const [resolvedFor, setResolvedFor] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const trimmedCity = city.trim();
  const isStale = resolved !== null && resolvedFor !== trimmedCity;
  const hasFreshGeocode = geocodeStatus === 'success' && resolved !== null && !isStale;
  const datesValid = isValidDate(startDate) && isValidDate(endDate) && startDate <= endDate;
  const canSubmit = hasFreshGeocode && datesValid && !submitting;

  const handleFindCity = async () => {
    if (!trimmedCity || geocodeStatus === 'loading') return;
    setGeocodeStatus('loading');
    setGeocodeError(null);
    try {
      const result = await geocodeCity(trimmedCity);
      if (result.found) {
        setResolved({
          city: result.city ?? trimmedCity,
          region: result.region ?? '',
          lat: result.lat,
          lon: result.lon,
        });
        setResolvedFor(trimmedCity);
        setGeocodeStatus('success');
      } else {
        setResolved(null);
        setResolvedFor(null);
        setGeocodeStatus('error');
        setGeocodeError("Couldn't find that city — check the spelling and try again.");
      }
    } catch (err) {
      setResolved(null);
      setResolvedFor(null);
      setGeocodeStatus('error');
      setGeocodeError(err instanceof Error ? err.message : "Couldn't look up that city — try again.");
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || !resolved) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        city: resolved.city,
        region: resolved.region,
        lat: resolved.lat,
        lon: resolved.lon,
        dates: { start: startDate, end: endDate },
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Couldn't save this stop — try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={s.container}>
      <Text style={s.label}>City</Text>
      <View style={s.row}>
        <TextInput
          testID="stop-form-city-input"
          style={[s.input, s.cityInput]}
          value={city}
          onChangeText={text => {
            setCity(text);
            // Typing after an error clears it — the previous failure no longer describes
            // the current input. A prior submit failure is also stale once the user starts
            // correcting the city (e.g. to re-trigger a geocode retry).
            if (geocodeStatus === 'error') {
              setGeocodeStatus('idle');
              setGeocodeError(null);
            }
            setSubmitError(null);
          }}
          placeholder="e.g. Portland, ME"
          placeholderTextColor={Core.textFaint}
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={handleFindCity}
        />
        <TouchableOpacity
          testID="stop-form-find-button"
          style={[s.findButton, (!trimmedCity || geocodeStatus === 'loading') && s.findButtonDisabled]}
          onPress={handleFindCity}
          disabled={!trimmedCity || geocodeStatus === 'loading'}
        >
          {geocodeStatus === 'loading' ? (
            <ActivityIndicator color={Core.white} size="small" />
          ) : (
            <Text style={s.findButtonText}>{geocodeStatus === 'error' ? 'Retry' : 'Find'}</Text>
          )}
        </TouchableOpacity>
      </View>

      {geocodeStatus === 'error' && geocodeError && (
        <Text style={s.errorText}>{geocodeError}</Text>
      )}
      {hasFreshGeocode && resolved && (
        <Text style={s.successText}>
          📍 {resolved.city}{resolved.region ? `, ${resolved.region}` : ''}
        </Text>
      )}

      <Text style={[s.label, s.dateLabel]}>Dates</Text>
      <View style={s.row}>
        <TextInput
          testID="stop-form-start-date"
          style={[s.input, s.dateInput]}
          value={startDate}
          onChangeText={text => {
            setStartDate(text);
            // Editing a date after a failed submit is the user correcting their input — the
            // stale error shouldn't linger over the fix.
            setSubmitError(null);
          }}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={Core.textFaint}
          autoCorrect={false}
          keyboardType="numbers-and-punctuation"
        />
        <Text style={s.dateSeparator}>–</Text>
        <TextInput
          testID="stop-form-end-date"
          style={[s.input, s.dateInput]}
          value={endDate}
          onChangeText={text => {
            setEndDate(text);
            setSubmitError(null);
          }}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={Core.textFaint}
          autoCorrect={false}
          keyboardType="numbers-and-punctuation"
        />
      </View>
      {startDate && endDate && isValidDate(startDate) && isValidDate(endDate) && startDate > endDate && (
        <Text style={s.errorText}>End date must be on or after the start date.</Text>
      )}

      {submitError && <Text style={s.errorText}>{submitError}</Text>}

      <View style={[s.row, s.actions]}>
        {onCancel && (
          <TouchableOpacity testID="stop-form-cancel-button" style={s.cancelButton} onPress={onCancel}>
            <Text style={s.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          testID="stop-form-submit-button"
          style={[s.submitButton, !canSubmit && s.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {submitting ? (
            <ActivityIndicator color={Core.white} size="small" />
          ) : (
            <Text style={s.submitButtonText}>{submitLabel}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
  label: {
    ...Typography.roles.label,
    color: Core.textMuted,
    marginBottom: Spacing.sm,
  },
  dateLabel: {
    marginTop: Spacing.base,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  input: {
    ...Typography.roles.body,
    color: Core.text,
    backgroundColor: Core.surfaceMuted,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  cityInput: {
    flex: 1,
  },
  dateInput: {
    flex: 1,
    textAlign: 'center',
  },
  dateSeparator: {
    ...Typography.roles.body,
    color: Core.textFaint,
  },
  findButton: {
    backgroundColor: Core.action,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  findButtonDisabled: {
    opacity: 0.5,
  },
  findButtonText: {
    ...Typography.roles.button,
    color: Core.white,
  },
  errorText: {
    ...Typography.roles.meta,
    color: Semantic.error,
    marginTop: Spacing.sm,
  },
  successText: {
    ...Typography.roles.meta,
    color: Semantic.success,
    marginTop: Spacing.sm,
  },
  actions: {
    marginTop: Spacing.xl,
    justifyContent: 'flex-end',
  },
  cancelButton: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  cancelButtonText: {
    ...Typography.roles.button,
    color: Core.textMuted,
  },
  submitButton: {
    backgroundColor: Core.action,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    ...Typography.roles.button,
    color: Core.white,
  },
});
