import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Calendar } from 'react-native-calendars';
import type { DateData } from 'react-native-calendars';
import { geocodeCity } from '@/src/lib/geocodeClient';
import { formatDateRange } from '@/src/utils/dates';
import { Core, Radius, Semantic, Spacing, Typography } from '@/src/design/tokens';

// react-native-calendars' bundled types omit `markingType` from CalendarProps even though
// the runtime Day component reads it directly (calendar/day/index.js) — widen the type here
// rather than casting at every call site.
const CalendarWithMarking = Calendar as React.ComponentType<
  React.ComponentProps<typeof Calendar> & { markingType?: 'period' }
>;

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
  /**
   * Seeds the form for edit mode. The city counts as already-resolved (geocodeStatus starts
   * 'success' with resolvedFor set), so an unedited city needs no re-lookup — but editing the
   * city text still invalidates it via the existing `isStale` check.
   */
  initialValues?: ResolvedStop;
}

type GeocodeStatus = 'idle' | 'loading' | 'success' | 'error';

type PeriodMark = { startingDay?: boolean; endingDay?: boolean; color: string; textColor?: string };

// Local-date (not UTC) construction throughout this file — avoids the off-by-one near
// local midnight that `new Date().toISOString()` can produce.
function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysISO(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return toISODate(new Date(y, m - 1, d + days));
}

/**
 * Shared, reusable stop-entry form: a city text field plus start/end date fields, both required.
 * Geocodes the typed city via `geocodeCity()` on demand (the "Find city" button) and blocks the
 * Continue action until that geocode has succeeded AND both dates are present — there is no
 * "continue anyway without coordinates" path. Not tied to any one screen: the Add Stop bottom
 * sheet and the onboarding wizard's first-stop step both render this directly and just supply a
 * different `onSubmit`.
 */
export function StopForm({ onSubmit, onCancel, submitLabel = 'Continue', initialValues }: StopFormProps) {
  const [city, setCity] = useState(initialValues?.city ?? '');
  const [startDate, setStartDate] = useState(initialValues?.dates.start ?? '');
  const [endDate, setEndDate] = useState(initialValues?.dates.end ?? '');

  const [geocodeStatus, setGeocodeStatus] = useState<GeocodeStatus>(initialValues ? 'success' : 'idle');
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  // The resolved lat/lon/city/region from the last SUCCESSFUL geocode, plus the exact city text
  // that was resolved — if `city` drifts from `resolvedFor` (the user edits the field after a
  // successful lookup), the resolution is stale and must not be trusted for submission anymore.
  const [resolved, setResolved] = useState<{ city: string; region: string; lat: number; lon: number } | null>(
    initialValues ? { city: initialValues.city, region: initialValues.region, lat: initialValues.lat, lon: initialValues.lon } : null
  );
  const [resolvedFor, setResolvedFor] = useState<string | null>(initialValues?.city.trim() ?? null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const trimmedCity = city.trim();
  const isStale = resolved !== null && resolvedFor !== trimmedCity;
  const hasFreshGeocode = geocodeStatus === 'success' && resolved !== null && !isStale;
  // Order can no longer be wrong by construction (see handleDayPress's swap logic below),
  // but the check costs nothing and documents the invariant.
  const datesValid = !!startDate && !!endDate && startDate <= endDate;
  const canSubmit = hasFreshGeocode && datesValid && !submitting;

  const today = useMemo(() => toISODate(new Date()), []);

  const handleDayPress = ({ dateString }: DateData) => {
    if (!startDate || endDate) {
      // No active range yet, or a full range already exists — start a fresh one.
      setStartDate(dateString);
      setEndDate('');
    } else if (dateString < startDate) {
      // Tapped before the current start — the new tap becomes start, old start becomes end.
      setEndDate(startDate);
      setStartDate(dateString);
    } else {
      setEndDate(dateString);
    }
    setSubmitError(null);
  };

  const markedDates = useMemo<Record<string, PeriodMark>>(() => {
    if (!startDate) return {};
    const rangeEnd = endDate || startDate;
    const marks: Record<string, PeriodMark> = {};
    let cursor = startDate;
    while (cursor <= rangeEnd) {
      marks[cursor] = {
        color: Core.action,
        textColor: Core.white,
        startingDay: cursor === startDate,
        endingDay: cursor === rangeEnd,
      };
      cursor = addDaysISO(cursor, 1);
    }
    return marks;
  }, [startDate, endDate]);

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
          onBlur={() => {
            // Auto-resolve on blur too, not just tap/Return — so tabbing straight to the
            // date picker still gets the city looked up without an extra explicit tap.
            // `hasFreshGeocode` guards against redundantly re-firing once already resolved
            // for this exact text; handleFindCity's own guard covers empty/already-loading.
            if (trimmedCity && geocodeStatus !== 'loading' && !hasFreshGeocode) {
              void handleFindCity();
            }
          }}
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

      {geocodeStatus === 'loading' && (
        <Text style={s.mutedText}>Looking up "{trimmedCity}"…</Text>
      )}
      {geocodeStatus === 'error' && geocodeError && (
        <Text style={s.errorText}>{geocodeError}</Text>
      )}
      {hasFreshGeocode && resolved && (
        <Text style={s.successText}>
          {resolved.city}{resolved.region ? `, ${resolved.region}` : ''}
        </Text>
      )}

      <Text style={[s.label, s.dateLabel]}>Dates</Text>
      <Text style={s.mutedText}>
        {startDate && endDate
          ? formatDateRange(startDate, endDate)
          : startDate
          ? 'Pick an end date'
          : 'Pick a start and end date'}
      </Text>
      <CalendarWithMarking
        testID="stop-form-calendar"
        current={today}
        minDate={today}
        enableSwipeMonths
        markingType="period"
        markedDates={markedDates}
        onDayPress={handleDayPress}
        style={s.calendar}
        theme={{
          calendarBackground: Core.surfaceMuted,
          todayTextColor: Core.action,
          arrowColor: Core.action,
          dayTextColor: Core.text,
          textDisabledColor: Core.textFaint,
          monthTextColor: Core.text,
        }}
      />

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
    ...Typography.roles.chip,
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
    borderRadius: Radius.icon,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  cityInput: {
    flex: 1,
  },
  mutedText: {
    ...Typography.roles.sub,
    color: Core.textMuted,
    marginBottom: Spacing.sm,
  },
  calendar: {
    borderRadius: Radius.icon,
  },
  findButton: {
    backgroundColor: Core.action,
    borderRadius: Radius.icon,
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
    ...Typography.roles.sub,
    color: Semantic.error,
    marginTop: Spacing.sm,
  },
  successText: {
    ...Typography.roles.sub,
    color: Core.action,
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
    borderRadius: Radius.icon,
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
