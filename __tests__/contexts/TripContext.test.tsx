jest.mock('@/src/hooks/useTripData', () => ({ useTripData: jest.fn() }));
jest.mock('@/src/hooks/useTripConfirms', () => ({ useTripConfirms: jest.fn() }));
jest.mock('@/src/hooks/useTripMembers', () => ({ useTripMembers: jest.fn() }));
jest.mock('@/src/hooks/useTripGroups', () => ({ useTripGroups: jest.fn() }));
jest.mock('@/src/lib/firebase', () => ({ auth: jest.fn() }));

import React from 'react';
import renderer from 'react-test-renderer';
import { TripProvider, useTripContext, type TripContextValue } from '@/src/contexts/TripContext';
import { useTripData } from '@/src/hooks/useTripData';
import { useTripConfirms } from '@/src/hooks/useTripConfirms';
import { useTripMembers } from '@/src/hooks/useTripMembers';
import { useTripGroups } from '@/src/hooks/useTripGroups';
import { auth } from '@/src/lib/firebase';
import type { Trip, Booking, ItineraryDay, TripMember, Group } from '@/src/types';

const mockUseTripData = useTripData as jest.Mock;
const mockUseTripConfirms = useTripConfirms as jest.Mock;
const mockUseTripMembers = useTripMembers as jest.Mock;
const mockUseTripGroups = useTripGroups as jest.Mock;
const mockAuth = auth as jest.Mock;

const trip: Trip = {
  id: 'trip-1',
  name: 'Test Trip',
  ownerUid: 'owner-uid',
  createdAt: 0,
  pills: [],
  inviteToken: 'tok',
  colorPack: { id: 'default', stopColors: ['#000'], heroGradient: ['#000', '#fff'] },
  setupIntent: { flights: true, stays: true, car: false, restaurants: true },
};

const bookings: Booking[] = [
  {
    id: 'booking-unrestricted',
    tripId: 'trip-1',
    stopId: 'stop-1',
    type: 'restaurant',
    restaurantName: 'Open to all',
    date: '2026-01-01',
  },
  {
    id: 'booking-restricted',
    tripId: 'trip-1',
    stopId: 'stop-1',
    type: 'restaurant',
    restaurantName: 'Hikers only',
    date: '2026-01-02',
    groupIds: ['group-1'],
  },
];

const itinerary: Record<string, ItineraryDay[]> = {
  'stop-1': [
    {
      id: 'day-1',
      stopId: 'stop-1',
      dateIso: '2026-01-01',
      items: [
        { id: 'item-unrestricted', type: 'custom', label: 'Open to all', order: 0 },
        { id: 'item-restricted', type: 'custom', label: 'Hikers only', order: 1, groupIds: ['group-1'] },
      ],
    },
  ],
};

const groups: Group[] = [
  { id: 'group-1', tripId: 'trip-1', name: 'Hikers', memberUids: ['bob'], createdBy: 'bob', createdAt: 0 },
];

const members: TripMember[] = [
  { uid: 'alice', handle: 'Alice', role: 'traveler', joinedAt: 0 },
  { uid: 'bob', handle: 'Bob', role: 'traveler', joinedAt: 0 },
  { uid: 'org-user', handle: 'Organizer', role: 'organizer', joinedAt: 0 },
];

function setupMocks(currentUid: string | null) {
  mockAuth.mockReturnValue({ currentUser: currentUid ? { uid: currentUid } : null });
  mockUseTripData.mockReturnValue({
    trip,
    stops: [],
    bookings,
    itinerary,
    status: 'ready',
    fromCache: false,
    retry: jest.fn(),
  });
  mockUseTripConfirms.mockReturnValue({ confirms: {}, setConfirm: jest.fn() });
  mockUseTripMembers.mockReturnValue({ members, status: 'ready' });
  mockUseTripGroups.mockReturnValue({ groups, status: 'ready' });
}

function Capture({ onCapture }: { onCapture: (ctx: TripContextValue) => void }) {
  onCapture(useTripContext());
  return null;
}

function renderWithUid(currentUid: string | null): TripContextValue {
  setupMocks(currentUid);
  let captured!: TripContextValue;
  renderer.act(() => {
    renderer.create(
      <TripProvider tripId="trip-1">
        <Capture onCapture={(ctx) => { captured = ctx; }} />
      </TripProvider>,
    );
  });
  return captured;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('TripProvider group-visibility filtering', () => {
  test('booking/item with no groupIds is visible regardless of membership', () => {
    const ctx = renderWithUid('alice'); // alice is not in group-1
    expect(ctx.bookings.map(b => b.id)).toContain('booking-unrestricted');
    expect(ctx.itinerary['stop-1'][0].items.map(i => i.id)).toContain('item-unrestricted');
  });

  test('group-scoped item is hidden for a currentUid not in that group', () => {
    const ctx = renderWithUid('alice'); // alice is not in group-1
    expect(ctx.bookings.map(b => b.id)).not.toContain('booking-restricted');
    expect(ctx.itinerary['stop-1'][0].items.map(i => i.id)).not.toContain('item-restricted');
  });

  test('group-scoped item is visible for a currentUid in that group', () => {
    const ctx = renderWithUid('bob'); // bob is in group-1
    expect(ctx.bookings.map(b => b.id)).toContain('booking-restricted');
    expect(ctx.itinerary['stop-1'][0].items.map(i => i.id)).toContain('item-restricted');
  });

  test('group-scoped item is visible for any currentUid whose role is organizer, even if not in the group', () => {
    const ctx = renderWithUid('org-user'); // organizer, not a member of group-1
    expect(ctx.bookings.map(b => b.id)).toContain('booking-restricted');
    expect(ctx.itinerary['stop-1'][0].items.map(i => i.id)).toContain('item-restricted');
  });

  test('exposes members, groups, and currentUid on the context value', () => {
    const ctx = renderWithUid('bob');
    expect(ctx.currentUid).toBe('bob');
    expect(ctx.members).toEqual(members);
    expect(ctx.groups).toEqual(groups);
  });
});
