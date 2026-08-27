import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Calendar } from 'react-native-calendars';
import type { DateData } from 'react-native-calendars';
import { Core, Radius, Semantic, Spacing, Typography } from '@/src/design/tokens';
import type { NewBooking } from '@/src/lib/bookingWrites';
import type {
  BookingType, FlightLeg, FlightBooking, HotelBooking, RentalBooking, RestaurantBooking,
} from '@/src/types';

// Same widening as StopForm: react-native-calendars' bundled types omit `markingType` even
// though the runtime Day component reads it.
const CalendarWithMarking = Calendar as React.ComponentType<
  React.ComponentProps<typeof Calendar> & { markingType?: 'period' }
>;

export type BookingFormValues =
  | Omit<FlightBooking, 'id' | 'tripId' | 'stopId'>
  | Omit<HotelBooking, 'id' | 'tripId' | 'stopId'>
  | Omit<RentalBooking, 'id' | 'tripId' | 'stopId'>
  | Omit<RestaurantBooking, 'id' | 'tripId' | 'stopId'>;

export interface BookingFormProps {
  type: BookingType;
  stopId: string;
  initialValues?: BookingFormValues;
  /** Rejections surface inline without clearing entered values — see StopForm's contract. */
  onSubmit: (booking: NewBooking) => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

type FieldKind = 'text' | 'time' | 'number' | 'date';

interface FieldSpec {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  autoCapitalize?: 'none' | 'characters' | 'words' | 'sentences';
}

// Which inputs render, in order. Required-ness lives in REQUIRED rather than here so that
// rental's two range-picked dates — which have no input row of their own — stay validated.
const FIELDS: Record<BookingType, FieldSpec[]> = {
  hotel: [
    { key: 'hotelName',        label: 'Hotel name',        kind: 'text', placeholder: 'e.g. The Press Hotel' },
    { key: 'checkIn',          label: 'Check-in',          kind: 'date' },
    { key: 'checkOut',         label: 'Check-out',         kind: 'date' },
    { key: 'roomType',         label: 'Room type',         kind: 'text', placeholder: 'Optional' },
    { key: 'address',          label: 'Address',           kind: 'text', placeholder: 'Optional' },
    { key: 'confirmationCode', label: 'Confirmation code', kind: 'text', placeholder: 'Optional', autoCapitalize: 'characters' },
  ],
  restaurant: [
    { key: 'restaurantName',   label: 'Restaurant',        kind: 'text', placeholder: 'e.g. Fore Street' },
    { key: 'date',             label: 'Date',              kind: 'date' },
    { key: 'time',             label: 'Time',              kind: 'time', placeholder: 'e.g. 7:30 PM' },
    { key: 'partySize',        label: 'Party size',        kind: 'number', placeholder: 'Optional' },
    { key: 'confirmationCode', label: 'Confirmation code', kind: 'text', placeholder: 'Optional', autoCapitalize: 'characters' },
  ],
  rental: [
    { key: 'company',          label: 'Company',           kind: 'text', placeholder: 'e.g. Hertz' },
    { key: 'carType',          label: 'Car type',          kind: 'text', placeholder: 'Optional' },
    { key: 'pickupLocation',   label: 'Pickup location',   kind: 'text', placeholder: 'e.g. PWM Airport' },
    { key: 'pickupTime',       label: 'Pickup time',       kind: 'time', placeholder: 'Optional' },
    { key: 'dropoffLocation',  label: 'Dropoff location',  kind: 'text', placeholder: 'e.g. BOS Airport' },
    { key: 'dropoffTime',      label: 'Dropoff time',      kind: 'time', placeholder: 'Optional' },
    { key: 'confirmationCode', label: 'Confirmation code', kind: 'text', placeholder: 'Optional', autoCapitalize: 'characters' },
  ],
  // Flight's per-leg fields render from LEG_FIELDS; only the shared code is a plain field.
  flight: [
    { key: 'confirmationCode', label: 'Confirmation code', kind: 'text', placeholder: 'Optional', autoCapitalize: 'characters' },
  ],
};

const REQUIRED: Record<BookingType, string[]> = {
  hotel: ['hotelName', 'checkIn', 'checkOut'],
  restaurant: ['restaurantName', 'date'],
  rental: ['company', 'pickupDate', 'dropoffDate', 'pickupLocation', 'dropoffLocation'],
  flight: [], // every leg field is required instead — see `legsComplete`
};

const LEG_FIELDS: FieldSpec[] = [
  { key: 'airline',       label: 'Airline',        kind: 'text',  placeholder: 'e.g. American' },
  { key: 'flightNumber',  label: 'Flight number',  kind: 'text',  placeholder: 'e.g. AA123', autoCapitalize: 'characters' },
  { key: 'origin',        label: 'From',           kind: 'text',  placeholder: 'IATA, e.g. CLT', autoCapitalize: 'characters' },
  { key: 'destination',   label: 'To',             kind: 'text',  placeholder: 'IATA, e.g. BWI', autoCapitalize: 'characters' },
  { key: 'departureDate', label: 'Departure date', kind: 'date' },
  { key: 'departureTime', label: 'Departure time', kind: 'time',  placeholder: 'e.g. 8:00 AM' },
  { key: 'arrivalTime',   label: 'Arrival time',   kind: 'time',  placeholder: 'e.g. 9:30 AM' },
];

type LegValues = Record<string, string>;

function emptyLeg(): LegValues {
  return Object.fromEntries(LEG_FIELDS.map(f => [f.key, '']));
}

// Local-date construction, not UTC — same reasoning as StopForm's copy.
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

function seedValues(initial?: BookingFormValues): Record<string, string> {
  if (!initial) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(initial)) {
    // `type` is a prop, `legs` has its own state, and null/undefined optionals stay unset
    // so they read as "blank" and get omitted again on submit.
    if (key === 'type' || key === 'legs' || value === null || value === undefined) continue;
    out[key] = String(value);
  }
  return out;
}

function seedLegs(initial?: BookingFormValues): LegValues[] {
  if (initial && initial.type === 'flight' && initial.legs?.length) {
    return initial.legs.map(leg => ({ ...emptyLeg(), ...Object.fromEntries(
      Object.entries(leg).map(([k, v]) => [k, v == null ? '' : String(v)]),
    ) }));
  }
  return [emptyLeg()];
}

const calendarTheme = {
  calendarBackground: Core.surfaceMuted,
  todayTextColor: Core.action,
  arrowColor: Core.action,
  dayTextColor: Core.text,
  textDisabledColor: Core.textFaint,
  monthTextColor: Core.text,
};

/**
 * Shared, reusable booking-entry form covering all four booking types. Presentation and local
 * validation only — no RTDB and no bottom-sheet knowledge, exactly like `StopForm`, so the same
 * component serves the add sheet, the edit sheet, and any future wizard step. The four types
 * share one component rather than four because the chrome (labels, inputs, submit row, spinner,
 * inline error) is identical; only the field list differs, and that lives in the FIELDS table.
 *
 * Optional fields left blank are *omitted* from the submitted object rather than sent as empty
 * strings — `addBooking` runs its input through `stripUndefined`, so omission is all that's needed.
 */
export function BookingForm({
  type, stopId, initialValues, onSubmit, onCancel, submitLabel = 'Save',
}: BookingFormProps) {
  const [values, setValues] = useState<Record<string, string>>(() => seedValues(initialValues));
  const [legs, setLegs] = useState<LegValues[]>(() => seedLegs(initialValues));
  // Only one calendar is expanded at a time — four stacked calendars would bury the submit row.
  const [openDateField, setOpenDateField] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fields = FIELDS[type];
  const val = (key: string) => values[key] ?? '';

  const legsComplete =
    type !== 'flight' ||
    (legs.length > 0 && legs.every(leg => LEG_FIELDS.every(f => (leg[f.key] ?? '').trim() !== '')));
  const requiredComplete = REQUIRED[type].every(key => val(key).trim() !== '');
  const canSubmit = requiredComplete && legsComplete && !submitting;

  const setValue = (key: string, text: string) => {
    setValues(prev => ({ ...prev, [key]: text }));
    setSubmitError(null);
  };

  const setLegValue = (index: number, key: string, text: string) => {
    setLegs(prev => prev.map((leg, i) => (i === index ? { ...leg, [key]: text } : leg)));
    setSubmitError(null);
  };

  // Picking a day on a single-date field commits it and collapses the calendar.
  const pickSingleDate = (apply: () => void) => {
    apply();
    setOpenDateField(null);
    setSubmitError(null);
  };

  // Rental's pickup/dropoff share one range calendar — the same swap-on-earlier-tap state
  // machine StopForm uses, so an out-of-order range is impossible by construction.
  const handleRentalDayPress = ({ dateString }: DateData) => {
    const completesRange = !!val('pickupDate') && !val('dropoffDate');
    setValues(prev => {
      const pickup = prev.pickupDate ?? '';
      const dropoff = prev.dropoffDate ?? '';
      if (!pickup || dropoff) return { ...prev, pickupDate: dateString, dropoffDate: '' };
      if (dateString < pickup) return { ...prev, pickupDate: dateString, dropoffDate: pickup };
      return { ...prev, dropoffDate: dateString };
    });
    if (completesRange) setOpenDateField(null);
    setSubmitError(null);
  };

  const rentalMarkedDates = useMemo(() => {
    const start = val('pickupDate');
    if (!start) return {};
    const end = val('dropoffDate') || start;
    const marks: Record<string, { startingDay?: boolean; endingDay?: boolean; color: string; textColor?: string }> = {};
    let cursor = start;
    while (cursor <= end) {
      marks[cursor] = {
        color: Core.action,
        textColor: Core.white,
        startingDay: cursor === start,
        endingDay: cursor === end,
      };
      cursor = addDaysISO(cursor, 1);
    }
    return marks;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.pickupDate, values.dropoffDate]);

  const buildBooking = (): NewBooking => {
    const t = (key: string) => val(key).trim();
    // Blank optionals are dropped rather than sent as '' — see the component doc comment.
    const opt = (key: string) => (t(key) ? { [key]: t(key) } : {});

    switch (type) {
      case 'hotel':
        return {
          type: 'hotel', stopId,
          hotelName: t('hotelName'), checkIn: t('checkIn'), checkOut: t('checkOut'),
          ...opt('roomType'), ...opt('address'), ...opt('confirmationCode'),
        };
      case 'restaurant': {
        const size = parseInt(t('partySize'), 10);
        return {
          type: 'restaurant', stopId,
          restaurantName: t('restaurantName'), date: t('date'),
          ...opt('time'),
          ...(Number.isNaN(size) ? {} : { partySize: size }),
          ...opt('confirmationCode'),
        };
      }
      case 'rental':
        return {
          type: 'rental', stopId,
          company: t('company'),
          pickupDate: t('pickupDate'), dropoffDate: t('dropoffDate'),
          pickupLocation: t('pickupLocation'), dropoffLocation: t('dropoffLocation'),
          ...opt('carType'), ...opt('pickupTime'), ...opt('dropoffTime'), ...opt('confirmationCode'),
        };
      case 'flight':
        return {
          type: 'flight', stopId,
          legs: legs.map(leg => Object.fromEntries(
            LEG_FIELDS.map(f => [f.key, (leg[f.key] ?? '').trim()]),
          ) as unknown as FlightLeg),
          ...opt('confirmationCode'),
        };
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit(buildBooking());
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Couldn't save this booking — try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderInput = (spec: FieldSpec, name: string, value: string, onChange: (text: string) => void) => (
    <View key={name} style={s.field}>
      <Text style={s.label}>{spec.label}</Text>
      <TextInput
        testID={`booking-form-${name}`}
        style={s.input}
        value={value}
        onChangeText={onChange}
        placeholder={spec.placeholder}
        placeholderTextColor={Core.textFaint}
        autoCorrect={false}
        autoCapitalize={spec.autoCapitalize ?? 'sentences'}
        keyboardType={spec.kind === 'number' ? 'number-pad' : 'default'}
      />
    </View>
  );

  const renderDateField = (spec: FieldSpec, name: string, value: string, onPick: (dateString: string) => void) => (
    <View key={name} style={s.field}>
      <Text style={s.label}>{spec.label}</Text>
      <TouchableOpacity
        testID={`booking-form-${name}`}
        style={s.dateTrigger}
        onPress={() => setOpenDateField(prev => (prev === name ? null : name))}
      >
        <Text style={value ? s.dateValue : s.datePlaceholder}>{value || 'Select a date'}</Text>
      </TouchableOpacity>
      {openDateField === name && (
        <CalendarWithMarking
          testID={`booking-form-${name}-calendar`}
          current={value || undefined}
          markedDates={value ? { [value]: { selected: true, selectedColor: Core.action } } : {}}
          onDayPress={({ dateString }: DateData) => pickSingleDate(() => onPick(dateString))}
          style={s.calendar}
          theme={calendarTheme}
        />
      )}
    </View>
  );

  return (
    <View style={s.container}>
      {type === 'flight' && legs.map((leg, index) => (
        <View key={`leg-${index}`} style={s.legBlock}>
          <View style={s.legHeader}>
            <Text style={s.legTitle}>Leg {index + 1}</Text>
            {legs.length > 1 && (
              <TouchableOpacity
                testID={`booking-form-leg-${index}-remove`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => setLegs(prev => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))}
              >
                <Text style={s.legRemoveText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
          {LEG_FIELDS.map(spec => {
            const name = `leg-${index}-${spec.key}`;
            return spec.kind === 'date'
              ? renderDateField(spec, name, leg[spec.key] ?? '', d => setLegValue(index, spec.key, d))
              : renderInput(spec, name, leg[spec.key] ?? '', text => setLegValue(index, spec.key, text));
          })}
        </View>
      ))}

      {type === 'flight' && (
        <TouchableOpacity
          testID="booking-form-add-leg"
          style={s.addLegButton}
          onPress={() => setLegs(prev => [...prev, emptyLeg()])}
        >
          <Text style={s.addLegText}>+ Add leg</Text>
        </TouchableOpacity>
      )}

      {type === 'rental' && (
        <View style={s.field}>
          <Text style={s.label}>Rental dates</Text>
          <View style={s.row}>
            <TouchableOpacity
              testID="booking-form-pickupDate"
              style={[s.dateTrigger, s.rangeTrigger]}
              onPress={() => setOpenDateField(prev => (prev === 'rental-dates' ? null : 'rental-dates'))}
            >
              <Text style={val('pickupDate') ? s.dateValue : s.datePlaceholder}>
                {val('pickupDate') || 'Pickup'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="booking-form-dropoffDate"
              style={[s.dateTrigger, s.rangeTrigger]}
              onPress={() => setOpenDateField(prev => (prev === 'rental-dates' ? null : 'rental-dates'))}
            >
              <Text style={val('dropoffDate') ? s.dateValue : s.datePlaceholder}>
                {val('dropoffDate') || 'Dropoff'}
              </Text>
            </TouchableOpacity>
          </View>
          {openDateField === 'rental-dates' && (
            <CalendarWithMarking
              testID="booking-form-rental-dates-calendar"
              current={val('pickupDate') || undefined}
              markingType="period"
              markedDates={rentalMarkedDates}
              onDayPress={handleRentalDayPress}
              style={s.calendar}
              theme={calendarTheme}
            />
          )}
        </View>
      )}

      {fields.map(spec =>
        spec.kind === 'date'
          ? renderDateField(spec, spec.key, val(spec.key), d => setValue(spec.key, d))
          : renderInput(spec, spec.key, val(spec.key), text => setValue(spec.key, text)),
      )}

      {submitError && <Text testID="booking-form-error" style={s.errorText}>{submitError}</Text>}

      <View style={[s.row, s.actions]}>
        {onCancel && (
          <TouchableOpacity testID="booking-form-cancel-button" style={s.cancelButton} onPress={onCancel}>
            <Text style={s.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          testID="booking-form-submit-button"
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
  container: { padding: Spacing.lg },
  field: { marginBottom: Spacing.base },
  label: {
    ...Typography.roles.chip,
    color: Core.textMuted,
    marginBottom: Spacing.sm,
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
  dateTrigger: {
    backgroundColor: Core.surfaceMuted,
    borderRadius: Radius.icon,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  rangeTrigger: { flex: 1 },
  dateValue: {
    ...Typography.roles.body,
    color: Core.text,
  },
  datePlaceholder: {
    ...Typography.roles.body,
    color: Core.textFaint,
  },
  calendar: {
    borderRadius: Radius.icon,
    marginTop: Spacing.sm,
  },
  legBlock: {
    borderWidth: 1,
    borderColor: Core.surfaceMuted,
    borderRadius: Radius.icon,
    padding: Spacing.base,
    marginBottom: Spacing.base,
  },
  legHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  legTitle: {
    ...Typography.roles.chip,
    color: Core.text,
  },
  legRemoveText: {
    ...Typography.roles.chip,
    color: Semantic.error,
  },
  addLegButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.base,
  },
  addLegText: {
    ...Typography.roles.button,
    color: Core.action,
  },
  errorText: {
    ...Typography.roles.sub,
    color: Semantic.error,
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
  submitButtonDisabled: { opacity: 0.4 },
  submitButtonText: {
    ...Typography.roles.button,
    color: Core.white,
  },
});
