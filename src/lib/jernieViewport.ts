import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'jernie-itinerary-viewport' });
const VERSION = 1;

export interface JernieViewport {
  dateIso: string;
  stopId: string | null;
  contentY: number;
  dayDeltaY: number;
  collapseY: number;
}

interface StoredJernieViewport extends JernieViewport {
  version: number;
}

function key(tripId: string): string {
  return `viewport_${tripId}`;
}

/** Returns only complete, finite viewport snapshots. Old or partial writes fail closed. */
export function readJernieViewport(tripId: string): JernieViewport | null {
  try {
    const raw = storage.getString(key(tripId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredJernieViewport>;
    if (
      value.version !== VERSION
      || typeof value.dateIso !== 'string'
      || (value.stopId !== null && typeof value.stopId !== 'string')
      || !Number.isFinite(value.contentY)
      || !Number.isFinite(value.dayDeltaY)
      || !Number.isFinite(value.collapseY)
    ) return null;
    return {
      dateIso: value.dateIso,
      stopId: value.stopId,
      contentY: value.contentY as number,
      dayDeltaY: value.dayDeltaY as number,
      collapseY: value.collapseY as number,
    };
  } catch {
    return null;
  }
}

export function writeJernieViewport(tripId: string, viewport: JernieViewport): void {
  storage.set(key(tripId), JSON.stringify({ version: VERSION, ...viewport }));
}
