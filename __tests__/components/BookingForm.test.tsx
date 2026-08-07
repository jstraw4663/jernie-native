// react-native-calendars' real internals aren't what this file tests — mock it down to a
// thin prop-forwarding stand-in, same approach as StopForm.test.tsx.
jest.mock('react-native-calendars', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    Calendar: (props: Record<string, unknown>) => ReactActual.createElement(View, props),
  };
});

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { BookingForm, type BookingFormValues } from '@/src/features/jernie/BookingForm';
import type { NewBooking } from '@/src/lib/bookingWrites';
import type { HotelBooking, FlightBooking } from '@/src/types';

const STOP_ID = 'stop-1';

function renderForm(ui: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(ui); });
  return tree;
}

function id(tree: renderer.ReactTestRenderer, testID: string) {
  return tree.root.findByProps({ testID });
}

function setText(tree: renderer.ReactTestRenderer, field: string, text: string) {
  act(() => { id(tree, `booking-form-${field}`).props.onChangeText(text); });
}

function dayData(dateString: string) {
  return {
    dateString,
    year: Number(dateString.slice(0, 4)),
    month: Number(dateString.slice(5, 7)),
    day: Number(dateString.slice(8, 10)),
    timestamp: new Date(dateString).getTime(),
  };
}

/** Opens a single-date field's disclosure calendar and picks a day on it. */
function pickDate(tree: renderer.ReactTestRenderer, field: string, dateString: string) {
  act(() => { id(tree, `booking-form-${field}`).props.onPress(); });
  act(() => { id(tree, `booking-form-${field}-calendar`).props.onDayPress(dayData(dateString)); });
}

/** Rental's pickup/dropoff share one range calendar — two taps fill both dates. */
function pickRentalRange(tree: renderer.ReactTestRenderer, start: string, end: string) {
  act(() => { id(tree, 'booking-form-pickupDate').props.onPress(); });
  act(() => { id(tree, 'booking-form-rental-dates-calendar').props.onDayPress(dayData(start)); });
  act(() => { id(tree, 'booking-form-rental-dates-calendar').props.onDayPress(dayData(end)); });
}

function submitDisabled(tree: renderer.ReactTestRenderer): boolean {
  return !!id(tree, 'booking-form-submit-button').props.disabled;
}

async function pressSubmit(tree: renderer.ReactTestRenderer) {
  await act(async () => { await id(tree, 'booking-form-submit-button').props.onPress(); });
}

function fillLeg(tree: renderer.ReactTestRenderer, i: number, leg: {
  airline: string; flightNumber: string; origin: string; destination: string;
  departureDate: string; departureTime: string; arrivalTime: string;
}) {
  setText(tree, `leg-${i}-airline`, leg.airline);
  setText(tree, `leg-${i}-flightNumber`, leg.flightNumber);
  setText(tree, `leg-${i}-origin`, leg.origin);
  setText(tree, `leg-${i}-destination`, leg.destination);
  pickDate(tree, `leg-${i}-departureDate`, leg.departureDate);
  setText(tree, `leg-${i}-departureTime`, leg.departureTime);
  setText(tree, `leg-${i}-arrivalTime`, leg.arrivalTime);
}

describe('BookingForm — hotel', () => {
  test('submit stays disabled until hotelName, checkIn and checkOut are all set', () => {
    const tree = renderForm(<BookingForm type="hotel" stopId={STOP_ID} onSubmit={jest.fn()} />);
    expect(submitDisabled(tree)).toBe(true);

    setText(tree, 'hotelName', 'The Press Hotel');
    expect(submitDisabled(tree)).toBe(true);

    pickDate(tree, 'checkIn', '2026-08-10');
    expect(submitDisabled(tree)).toBe(true);

    pickDate(tree, 'checkOut', '2026-08-14');
    expect(submitDisabled(tree)).toBe(false);
  });

  test('omits blank optional fields entirely rather than submitting empty strings', async () => {
    const onSubmit = jest.fn();
    const tree = renderForm(<BookingForm type="hotel" stopId={STOP_ID} onSubmit={onSubmit} />);

    setText(tree, 'hotelName', 'The Press Hotel');
    pickDate(tree, 'checkIn', '2026-08-10');
    pickDate(tree, 'checkOut', '2026-08-14');
    await pressSubmit(tree);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const booking = onSubmit.mock.calls[0][0] as NewBooking & HotelBooking;
    expect(booking).toEqual({
      type: 'hotel',
      stopId: STOP_ID,
      hotelName: 'The Press Hotel',
      checkIn: '2026-08-10',
      checkOut: '2026-08-14',
    });
    expect('roomType' in booking).toBe(false);
    expect('confirmationCode' in booking).toBe(false);
    expect('address' in booking).toBe(false);
  });

  test('includes optional fields once they are filled in', async () => {
    const onSubmit = jest.fn();
    const tree = renderForm(<BookingForm type="hotel" stopId={STOP_ID} onSubmit={onSubmit} />);

    setText(tree, 'hotelName', 'The Press Hotel');
    pickDate(tree, 'checkIn', '2026-08-10');
    pickDate(tree, 'checkOut', '2026-08-14');
    setText(tree, 'roomType', 'King');
    setText(tree, 'confirmationCode', 'ABC123');
    setText(tree, 'address', '119 Exchange St');
    await pressSubmit(tree);

    expect(onSubmit.mock.calls[0][0]).toEqual({
      type: 'hotel',
      stopId: STOP_ID,
      hotelName: 'The Press Hotel',
      checkIn: '2026-08-10',
      checkOut: '2026-08-14',
      roomType: 'King',
      confirmationCode: 'ABC123',
      address: '119 Exchange St',
    });
  });
});

describe('BookingForm — restaurant', () => {
  test('requires a name and a date', () => {
    const tree = renderForm(<BookingForm type="restaurant" stopId={STOP_ID} onSubmit={jest.fn()} />);
    expect(submitDisabled(tree)).toBe(true);
    setText(tree, 'restaurantName', 'Fore Street');
    expect(submitDisabled(tree)).toBe(true);
    pickDate(tree, 'date', '2026-08-11');
    expect(submitDisabled(tree)).toBe(false);
  });

  test('submits partySize as a number, not the typed string', async () => {
    const onSubmit = jest.fn();
    const tree = renderForm(<BookingForm type="restaurant" stopId={STOP_ID} onSubmit={onSubmit} />);

    setText(tree, 'restaurantName', 'Fore Street');
    pickDate(tree, 'date', '2026-08-11');
    setText(tree, 'time', '7:30 PM');
    setText(tree, 'partySize', '4');
    await pressSubmit(tree);

    const booking = onSubmit.mock.calls[0][0] as NewBooking;
    expect(booking).toEqual({
      type: 'restaurant',
      stopId: STOP_ID,
      restaurantName: 'Fore Street',
      date: '2026-08-11',
      time: '7:30 PM',
      partySize: 4,
    });
    expect(typeof (booking as { partySize: unknown }).partySize).toBe('number');
  });

  test('omits partySize when left blank', async () => {
    const onSubmit = jest.fn();
    const tree = renderForm(<BookingForm type="restaurant" stopId={STOP_ID} onSubmit={onSubmit} />);
    setText(tree, 'restaurantName', 'Fore Street');
    pickDate(tree, 'date', '2026-08-11');
    await pressSubmit(tree);
    expect('partySize' in (onSubmit.mock.calls[0][0] as object)).toBe(false);
  });
});

describe('BookingForm — rental', () => {
  test('requires company, both dates, and both locations', () => {
    const tree = renderForm(<BookingForm type="rental" stopId={STOP_ID} onSubmit={jest.fn()} />);
    expect(submitDisabled(tree)).toBe(true);

    setText(tree, 'company', 'Hertz');
    expect(submitDisabled(tree)).toBe(true);

    pickRentalRange(tree, '2026-08-10', '2026-08-14');
    expect(submitDisabled(tree)).toBe(true);

    setText(tree, 'pickupLocation', 'PWM Airport');
    expect(submitDisabled(tree)).toBe(true);

    setText(tree, 'dropoffLocation', 'BOS Airport');
    expect(submitDisabled(tree)).toBe(false);
  });

  test('submits the picked range as pickupDate and dropoffDate', async () => {
    const onSubmit = jest.fn();
    const tree = renderForm(<BookingForm type="rental" stopId={STOP_ID} onSubmit={onSubmit} />);

    setText(tree, 'company', 'Hertz');
    pickRentalRange(tree, '2026-08-10', '2026-08-14');
    setText(tree, 'pickupLocation', 'PWM Airport');
    setText(tree, 'dropoffLocation', 'BOS Airport');
    await pressSubmit(tree);

    expect(onSubmit.mock.calls[0][0]).toEqual({
      type: 'rental',
      stopId: STOP_ID,
      company: 'Hertz',
      pickupDate: '2026-08-10',
      dropoffDate: '2026-08-14',
      pickupLocation: 'PWM Airport',
      dropoffLocation: 'BOS Airport',
    });
  });
});

describe('BookingForm — flight', () => {
  const LEG_A = {
    airline: 'American', flightNumber: 'AA123', origin: 'CLT', destination: 'BWI',
    departureDate: '2026-08-10', departureTime: '8:00 AM', arrivalTime: '9:30 AM',
  };
  const LEG_B = {
    airline: 'Southwest', flightNumber: 'WN456', origin: 'BWI', destination: 'PWM',
    departureDate: '2026-08-10', departureTime: '11:00 AM', arrivalTime: '12:45 PM',
  };

  test('renders exactly one leg by default and hides the remove control for it', () => {
    const tree = renderForm(<BookingForm type="flight" stopId={STOP_ID} onSubmit={jest.fn()} />);
    expect(tree.root.findAllByProps({ testID: 'booking-form-leg-0-airline' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: 'booking-form-leg-1-airline' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: 'booking-form-leg-0-remove' })).toHaveLength(0);
  });

  test('requires every field on the only leg', () => {
    const tree = renderForm(<BookingForm type="flight" stopId={STOP_ID} onSubmit={jest.fn()} />);
    expect(submitDisabled(tree)).toBe(true);
    setText(tree, 'leg-0-airline', LEG_A.airline);
    setText(tree, 'leg-0-flightNumber', LEG_A.flightNumber);
    setText(tree, 'leg-0-origin', LEG_A.origin);
    setText(tree, 'leg-0-destination', LEG_A.destination);
    pickDate(tree, 'leg-0-departureDate', LEG_A.departureDate);
    setText(tree, 'leg-0-departureTime', LEG_A.departureTime);
    expect(submitDisabled(tree)).toBe(true);
    setText(tree, 'leg-0-arrivalTime', LEG_A.arrivalTime);
    expect(submitDisabled(tree)).toBe(false);
  });

  test('a second leg blocks submit until it too is complete', () => {
    const tree = renderForm(<BookingForm type="flight" stopId={STOP_ID} onSubmit={jest.fn()} />);
    fillLeg(tree, 0, LEG_A);
    expect(submitDisabled(tree)).toBe(false);

    act(() => { id(tree, 'booking-form-add-leg').props.onPress(); });
    expect(submitDisabled(tree)).toBe(true);

    fillLeg(tree, 1, LEG_B);
    expect(submitDisabled(tree)).toBe(false);
  });

  test('submits both legs in entry order', async () => {
    const onSubmit = jest.fn();
    const tree = renderForm(<BookingForm type="flight" stopId={STOP_ID} onSubmit={onSubmit} />);
    fillLeg(tree, 0, LEG_A);
    act(() => { id(tree, 'booking-form-add-leg').props.onPress(); });
    fillLeg(tree, 1, LEG_B);
    await pressSubmit(tree);

    const booking = onSubmit.mock.calls[0][0] as NewBooking & FlightBooking;
    expect(booking.legs).toHaveLength(2);
    expect(booking.legs[0]).toEqual(LEG_A);
    expect(booking.legs[1]).toEqual(LEG_B);
    expect(booking.type).toBe('flight');
    expect(booking.stopId).toBe(STOP_ID);
    expect('confirmationCode' in booking).toBe(false);
  });

  test('removing a leg drops it and hides the remove control once one leg is left', () => {
    const tree = renderForm(<BookingForm type="flight" stopId={STOP_ID} onSubmit={jest.fn()} />);
    fillLeg(tree, 0, LEG_A);
    act(() => { id(tree, 'booking-form-add-leg').props.onPress(); });
    expect(tree.root.findAllByProps({ testID: 'booking-form-leg-1-airline' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: 'booking-form-leg-0-remove' }).length).toBeGreaterThan(0);

    act(() => { id(tree, 'booking-form-leg-1-remove').props.onPress(); });
    expect(tree.root.findAllByProps({ testID: 'booking-form-leg-1-airline' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: 'booking-form-leg-0-remove' })).toHaveLength(0);
    expect(submitDisabled(tree)).toBe(false);
  });
});

describe('BookingForm — edit mode', () => {
  test('pre-fills every hotel field and enables submit immediately', () => {
    const initialValues: BookingFormValues = {
      type: 'hotel',
      hotelName: 'The Press Hotel',
      checkIn: '2026-08-10',
      checkOut: '2026-08-14',
      roomType: 'King',
      confirmationCode: 'ABC123',
      address: '119 Exchange St',
    };
    const tree = renderForm(
      <BookingForm type="hotel" stopId={STOP_ID} initialValues={initialValues} onSubmit={jest.fn()} />,
    );

    expect(submitDisabled(tree)).toBe(false);
    expect(id(tree, 'booking-form-hotelName').props.value).toBe('The Press Hotel');
    expect(id(tree, 'booking-form-roomType').props.value).toBe('King');
    expect(id(tree, 'booking-form-confirmationCode').props.value).toBe('ABC123');
    expect(id(tree, 'booking-form-address').props.value).toBe('119 Exchange St');
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('2026-08-10');
    expect(json).toContain('2026-08-14');
  });

  test('pre-fills a multi-leg flight and submits it back unchanged', async () => {
    const initialValues: BookingFormValues = {
      type: 'flight',
      legs: [
        { airline: 'American', flightNumber: 'AA123', origin: 'CLT', destination: 'BWI', departureDate: '2026-08-10', departureTime: '8:00 AM', arrivalTime: '9:30 AM' },
        { airline: 'Southwest', flightNumber: 'WN456', origin: 'BWI', destination: 'PWM', departureDate: '2026-08-10', departureTime: '11:00 AM', arrivalTime: '12:45 PM' },
      ],
      confirmationCode: 'XYZ789',
    };
    const onSubmit = jest.fn();
    const tree = renderForm(
      <BookingForm type="flight" stopId={STOP_ID} initialValues={initialValues} onSubmit={onSubmit} />,
    );

    expect(submitDisabled(tree)).toBe(false);
    expect(id(tree, 'booking-form-leg-1-flightNumber').props.value).toBe('WN456');
    await pressSubmit(tree);

    expect(onSubmit.mock.calls[0][0]).toEqual({
      type: 'flight',
      stopId: STOP_ID,
      legs: initialValues.legs,
      confirmationCode: 'XYZ789',
    });
  });
});

describe('BookingForm — submit rejection', () => {
  test('surfaces an inline error and keeps the entered values', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('network down'));
    const tree = renderForm(<BookingForm type="hotel" stopId={STOP_ID} onSubmit={onSubmit} />);

    setText(tree, 'hotelName', 'The Press Hotel');
    pickDate(tree, 'checkIn', '2026-08-10');
    pickDate(tree, 'checkOut', '2026-08-14');
    await pressSubmit(tree);

    expect(tree.root.findAllByProps({ testID: 'booking-form-error' }).length).toBeGreaterThan(0);
    expect(JSON.stringify(tree.toJSON())).toContain('network down');
    // Entered data survives so the user can just retry.
    expect(id(tree, 'booking-form-hotelName').props.value).toBe('The Press Hotel');
    expect(submitDisabled(tree)).toBe(false);
  });
});

describe('BookingForm — cancel', () => {
  test('renders a cancel control only when onCancel is supplied', () => {
    const without = renderForm(<BookingForm type="hotel" stopId={STOP_ID} onSubmit={jest.fn()} />);
    expect(without.root.findAllByProps({ testID: 'booking-form-cancel-button' })).toHaveLength(0);

    const onCancel = jest.fn();
    const withCancel = renderForm(
      <BookingForm type="hotel" stopId={STOP_ID} onSubmit={jest.fn()} onCancel={onCancel} />,
    );
    act(() => { id(withCancel, 'booking-form-cancel-button').props.onPress(); });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
