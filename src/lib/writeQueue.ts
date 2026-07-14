import { createMMKV } from 'react-native-mmkv';
import { generateId } from '@/src/utils/id';
import type { WriteQueueEntry } from '@/src/types';

const QUEUE_KEY = 'jernie_write_queue';
const storage = createMMKV({ id: 'jernie-write-queue' });

// ── Storage adapter (swap readRaw/persistRaw for tests or migration) ──────────

function readRaw(): string | null {
  return storage.getString(QUEUE_KEY) ?? null;
}

function persistRaw(raw: string): void {
  storage.set(QUEUE_KEY, raw);
}

// ── Core queue operations ────────────────────────────────────────────────────

function loadQueue(): WriteQueueEntry[] {
  try {
    const raw = readRaw();
    if (!raw) return [];
    return JSON.parse(raw) as WriteQueueEntry[];
  } catch {
    return [];
  }
}

function saveQueue(entries: WriteQueueEntry[]): void {
  persistRaw(JSON.stringify(entries));
}

export function getQueue(): WriteQueueEntry[] {
  return loadQueue();
}

export function enqueue(path: string, value: unknown): void {
  const entries = loadQueue();
  entries.push({ id: generateId(), path, value, timestamp: Date.now() });
  saveQueue(entries);
  notifySubscribers();
}

export function enqueueMany(items: { path: string; value: unknown }[]): void {
  const entries = loadQueue();
  const now = Date.now();
  for (const item of items) {
    entries.push({ id: generateId(), path: item.path, value: item.value, timestamp: now });
  }
  saveQueue(entries);
  notifySubscribers();
}

export function removeWhere(predicate: (e: WriteQueueEntry) => boolean): void {
  const entries = loadQueue().filter((e) => !predicate(e));
  saveQueue(entries);
  notifySubscribers();
}

export function flush(): void {
  saveQueue([]);
  notifySubscribers();
}

type Subscriber = (count: number) => void;
const subscribers = new Set<Subscriber>();

function notifySubscribers(): void {
  const count = loadQueue().length;
  subscribers.forEach((fn) => fn(count));
}

export function subscribe(fn: Subscriber): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
