import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Calendar } from 'react-native-calendars';
import type { DateData } from 'react-native-calendars';
import { searchStops, type StopSearchResult } from '@/src/lib/stopSearchClient';
import { describeCallableError } from '@/src/domain/callableError';
import { formatDateRange } from '@/src/utils/dates';
import { ListRow } from '@/src/ui';
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
   * Seeds the form for edit mode. The city counts as already-resolved (searchStatus starts
   * 'success' with resolvedFor set), so an unedited city needs no re-lookup — but editing the
   * city text still invalidates it via the existing `isStale` check.
   */
  initialValues?: ResolvedStop;
}

// 'choosing' is the state the single-result geocode this replaced could never be in:
// several towns matched and the form is waiting for a human to say which one.
type SearchStatus = 'idle' | 'loading' | 'choosing' | 'success' | 'error';

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
 * Searches the typed city via `searchStops()` on demand (the "Find" button) and blocks the
 * Continue action until a stop has been RESOLVED and both dates are present — there is no
 * "continue anyway without coordinates" path. Not tied to any one screen: the Add Stop bottom
 * sheet and the onboarding wizard's first-stop step both render this directly and just supply a
 * different `onSubmit`.
 *
 * EVERY search answers with cards, and resolves nothing until one is tapped — however few
 * matches come back.
 *
 * The single-match case briefly auto-resolved, on the reasoning that one result leaves
 * nothing to choose between. That reasoning was wrong, and live data is what showed it: an
 * unanchored search for "camden" returns exactly one result and it is Camden, SOUTH
 * CAROLINA, not the Camden in Maine that was meant. One result means one result RANKED, not
 * one that exists — so auto-resolving commits the trip to a town the user never saw, which
 * is the precise failure of the single-result Google geocode this replaced.
 *
 * The cost is one tap on an unambiguous query. What it buys is that the app never silently
 * decides which Portland you meant, and that the flow looks the same every time.
 *
 * The search is unanchored — `searchStops` accepts a proximity anchor and this does not pass
 * one. A stop is searched for by name, and the trip's other stops are not evidence about where
 * the next one is; the ambiguity that anchoring would resolve is the ambiguity the picker
 * resolves better, by asking.
 */
export function StopForm({ onSubmit, onCancel, submitLabel = 'Continue', initialValues }: StopFormProps) {
  const [city, setCity] = useState(initialValues?.city ?? '');
  const [startDate, setStartDate] = useState(initialValues?.dates.start ?? '');
  const [endDate, setEndDate] = useState(initialValues?.dates.end ?? '');

  const [searchStatus, setSearchStatus] = useState<SearchStatus>(initialValues ? 'success' : 'idle');
  const [searchError, setSearchError] = useState<string | null>(null);
  // The matches still awaiting a choice. Non-empty ONLY in the 'choosing' state — cleared the
  // moment one is picked, the query is edited, or a new search starts, so a stale list can
  // never sit under a resolution it no longer describes.
  const [results, setResults] = useState<StopSearchResult[]>([]);
  // The chosen lat/lon/city/region, plus the exact city text it was resolved for — if `city`
  // drifts from `resolvedFor` (the user edits the field after resolving), the resolution is
  // stale and must not be trusted for submission anymore.
  const [resolved, setResolved] = useState<{ city: string; region: string; lat: number; lon: number } | null>(
    initialValues ? { city: initialValues.city, region: initialValues.region, lat: initialValues.lat, lon: initialValues.lon } : null
  );
  const [resolvedFor, setResolvedFor] = useState<string | null>(initialValues?.city.trim() ?? null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const trimmedCity = city.trim();
  const isStale = resolved !== null && resolvedFor !== trimmedCity;
  const hasFreshResolution = searchStatus === 'success' && resolved !== null && !isStale;
  // Order can no longer be wrong by construction (see handleDayPress's swap logic below),
  // but the check costs nothing and documents the invariant.
  const datesValid = !!startDate && !!endDate && startDate <= endDate;
  const canSubmit = hasFreshResolution && datesValid && !submitting;

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

  const resolveTo = (result: StopSearchResult, forQuery: string) => {
    setResolved({
      city: result.name,
      // Empty string, not undefined — Stop.region is a string, and the form has always
      // written one. A result genuinely outside a region-coded country ("Chamonix,
      // France") simply has none.
      region: result.region ?? '',
      lat: result.lat,
      lon: result.lon,
    });
    setResolvedFor(forQuery);
    setResults([]);
    setSearchStatus('success');
  };

  const handleFindCity = async () => {
    if (!trimmedCity || searchStatus === 'loading') return;
    setSearchStatus('loading');
    setSearchError(null);
    // Cleared before the call, not after: leaving the previous query's rows on screen
    // while a new search runs invites a tap on a row that no longer matches what is typed.
    setResults([]);
    try {
      const matches = await searchStops(trimmedCity);

      // A search RESOLVES NOTHING on its own, however few matches come back. See the
      // component doc for why one result is not the same as one candidate.
      setResolved(null);
      setResolvedFor(null);

      if (matches.length === 0) {
        setSearchStatus('error');
        setSearchError("Couldn't find that city — check the spelling and try again.");
        return;
      }

      setResults(matches);
      setSearchStatus('choosing');
    } catch (err) {
      setResolved(null);
      setResolvedFor(null);
      setSearchStatus('error');
      // Never `err.message`: a callable rejects with a gRPC status, and printing it put the
      // words "NOT FOUND" on a traveller's screen when searchStops was not yet deployed.
      setSearchError(describeCallableError(err, "Couldn't look up that city — try again."));
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
      setSubmitError(describeCallableError(err, "Couldn't save this stop — try again."));
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
            if (searchStatus === 'error') {
              setSearchStatus('idle');
              setSearchError(null);
            }
            // A list of matches for the old text is stale the moment the text changes —
            // and worse than stale, since tapping one would resolve to a place the field
            // no longer names.
            setResults([]);
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
            // `hasFreshResolution` guards against redundantly re-firing once already
            // resolved for this exact text; handleFindCity's own guard covers
            // empty/already-loading.
            //
            // The `results` guard is the one that is easy to miss: tapping a row blurs
            // this field, so without it every choice would spend a second billed lookup
            // AND swap the list out from under the finger that is landing on it. Results
            // are cleared on every edit, so a non-empty list always describes what is
            // typed right now.
            if (trimmedCity && searchStatus !== 'loading' && !hasFreshResolution && results.length === 0) {
              void handleFindCity();
            }
          }}
        />
        <TouchableOpacity
          testID="stop-form-find-button"
          style={[s.findButton, (!trimmedCity || searchStatus === 'loading') && s.findButtonDisabled]}
          onPress={handleFindCity}
          disabled={!trimmedCity || searchStatus === 'loading'}
        >
          {searchStatus === 'loading' ? (
            <ActivityIndicator color={Core.white} size="small" />
          ) : (
            <Text style={s.findButtonText}>{searchStatus === 'error' ? 'Retry' : 'Find'}</Text>
          )}
        </TouchableOpacity>
      </View>

      {searchStatus === 'loading' && (
        <Text style={s.mutedText}>Looking up "{trimmedCity}"…</Text>
      )}
      {searchStatus === 'error' && searchError && (
        <Text style={s.errorText}>{searchError}</Text>
      )}

      {results.length > 0 && (
        <View style={s.results}>
          <Text style={s.mutedText}>Which one?</Text>
          {results.map((result, index) => (
            <ListRow
              testID={`stop-form-result-${index}`}
              // Coordinates, not the name — the whole point here is several rows sharing
              // one name, so a name-keyed list would collide on exactly the case this
              // exists to handle.
              key={`${result.lat},${result.lon}`}
              title={`${result.name}${result.region ? `, ${result.region}` : ''}`}
              sub={result.context}
              onPress={() => resolveTo(result, trimmedCity)}
            />
          ))}
        </View>
      )}

      {hasFreshResolution && resolved && (
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
  results: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
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
