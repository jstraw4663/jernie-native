import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import type { MapsAppId } from '@/src/types';

export type MapsPlatform = 'ios' | 'android' | 'web';

export interface MapsAppOption {
  id: MapsAppId;
  label: string;
  url: string;
  alwaysAvailable: boolean;
}

function platformOf(value: typeof Platform.OS): MapsPlatform {
  if (value === 'ios' || value === 'android') return value;
  return 'web';
}

/** Pure URL construction; every destination is encoded as data, never interpolated as syntax. */
export function mapsAppCandidates(address: string, platform: MapsPlatform): MapsAppOption[] {
  const destination = encodeURIComponent(address.trim());
  if (!destination) return [];

  if (platform === 'ios') {
    return [
      { id: 'apple', label: 'Apple Maps', url: `maps://?daddr=${destination}`, alwaysAvailable: true },
      { id: 'google', label: 'Google Maps', url: `comgooglemaps://?daddr=${destination}&directionsmode=driving`, alwaysAvailable: false },
      { id: 'waze', label: 'Waze', url: `waze://?q=${destination}&navigate=yes`, alwaysAvailable: false },
    ];
  }

  if (platform === 'android') {
    return [
      { id: 'system', label: 'Maps', url: `geo:0,0?q=${destination}`, alwaysAvailable: true },
      { id: 'google', label: 'Google Maps', url: `google.navigation:q=${destination}&mode=d`, alwaysAvailable: false },
      { id: 'waze', label: 'Waze', url: `waze://?q=${destination}&navigate=yes`, alwaysAvailable: false },
    ];
  }

  return [{
    id: 'system',
    label: 'Google Maps',
    url: `https://www.google.com/maps/dir/?api=1&destination=${destination}`,
    alwaysAvailable: true,
  }];
}

export function mapsAppLabel(id?: MapsAppId): string {
  if (!id) return 'Ask every time';
  return {
    apple: 'Apple Maps',
    google: 'Google Maps',
    waze: 'Waze',
    system: 'Maps',
  }[id];
}

export async function getAvailableMapsApps(
  address: string,
  platform: MapsPlatform = platformOf(Platform.OS),
): Promise<MapsAppOption[]> {
  const candidates = mapsAppCandidates(address, platform);
  const availability = await Promise.all(candidates.map(async candidate => {
    if (candidate.alwaysAvailable) return true;
    try {
      return await Linking.canOpenURL(candidate.url);
    } catch {
      return false;
    }
  }));
  return candidates.filter((_, index) => availability[index]);
}

export async function openMapsApp(
  appId: MapsAppId,
  address: string,
  platform: MapsPlatform = platformOf(Platform.OS),
): Promise<boolean> {
  const candidate = mapsAppCandidates(address, platform).find(option => option.id === appId);
  if (!candidate) return false;
  try {
    if (!candidate.alwaysAvailable && !(await Linking.canOpenURL(candidate.url))) return false;
    await Linking.openURL(candidate.url);
    return true;
  } catch {
    return false;
  }
}
