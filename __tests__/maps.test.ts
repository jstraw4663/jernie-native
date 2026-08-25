jest.mock('expo-linking', () => ({
  canOpenURL: jest.fn(),
  openURL: jest.fn(),
}));

import * as Linking from 'expo-linking';
import { getAvailableMapsApps, mapsAppCandidates, mapsAppLabel, openMapsApp } from '@/src/lib/maps';

const canOpenURL = Linking.canOpenURL as jest.Mock;
const openURL = Linking.openURL as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  canOpenURL.mockResolvedValue(false);
  openURL.mockResolvedValue(true);
});

test('builds encoded app-specific direction URLs', () => {
  expect(mapsAppCandidates('119 Exchange St, Portland, ME', 'ios')).toEqual([
    expect.objectContaining({ id: 'apple', url: 'maps://?daddr=119%20Exchange%20St%2C%20Portland%2C%20ME' }),
    expect.objectContaining({ id: 'google', url: 'comgooglemaps://?daddr=119%20Exchange%20St%2C%20Portland%2C%20ME&directionsmode=driving' }),
    expect.objectContaining({ id: 'waze', url: 'waze://?q=119%20Exchange%20St%2C%20Portland%2C%20ME&navigate=yes' }),
  ]);
});

test('offers explicit Google Maps and Waze directions on Android', () => {
  expect(mapsAppCandidates('119 Exchange St, Portland, ME', 'android')).toEqual([
    expect.objectContaining({ id: 'system', url: 'geo:0,0?q=119%20Exchange%20St%2C%20Portland%2C%20ME' }),
    expect.objectContaining({ id: 'google', url: 'google.navigation:q=119%20Exchange%20St%2C%20Portland%2C%20ME&mode=d' }),
    expect.objectContaining({ id: 'waze', url: 'waze://?q=119%20Exchange%20St%2C%20Portland%2C%20ME&navigate=yes' }),
  ]);
});

test('returns no candidates for an empty address', () => {
  expect(mapsAppCandidates('   ', 'ios')).toEqual([]);
});

test('keeps the system app and filters unavailable optional apps', async () => {
  canOpenURL.mockImplementation(async (url: string) => url.startsWith('comgooglemaps:'));
  await expect(getAvailableMapsApps('119 Exchange St', 'ios')).resolves.toEqual([
    expect.objectContaining({ id: 'apple' }),
    expect.objectContaining({ id: 'google' }),
  ]);
});

test('opens a chosen installed app and reports a missing saved app', async () => {
  canOpenURL.mockResolvedValueOnce(true);
  await expect(openMapsApp('google', '119 Exchange St', 'ios')).resolves.toBe(true);
  expect(openURL).toHaveBeenCalledWith('comgooglemaps://?daddr=119%20Exchange%20St&directionsmode=driving');

  canOpenURL.mockResolvedValueOnce(false);
  await expect(openMapsApp('waze', '119 Exchange St', 'ios')).resolves.toBe(false);
  expect(openURL).toHaveBeenCalledTimes(1);
});

test('labels a missing preference as ask every time', () => {
  expect(mapsAppLabel()).toBe('Ask every time');
  expect(mapsAppLabel('apple')).toBe('Apple Maps');
});
