import { getFirestore } from 'firebase-admin/firestore';
import { getEnrichment, writeEnrichment } from '../src/repository';
import type { PlaceEnrichment } from '../src/types';

// Note: `firebase-admin/app` is deliberately left un-mocked here — the real
// `initializeApp()`/`getApps()` are synchronous, side-effect-free (no network I/O, no
// throw) when called with no explicit config, as confirmed by hand before writing this
// suite, so letting repository.ts run its real module-scope initialization against the
// real `firebase-admin/app` doesn't require credentials or touch the network. Only
// `firebase-admin/firestore` needs mocking, since getEnrichment/writeEnrichment must not
// hit a real Firestore backend in tests. The default `getFirestore` mock return value
// includes a `settings` stub so the real module-scope `getFirestore().settings(...)`
// call — which runs at import time, before any `beforeEach` — has something to call.
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => ({ settings: jest.fn() })),
}));

const mockGetFirestore = getFirestore as jest.MockedFunction<typeof getFirestore>;

// Captured synchronously during Jest's test-collection pass, i.e. immediately after the
// `import '../src/repository'` above has already run its real, one-time module-scope
// initialization — and therefore *before* any `beforeEach`/`jest.clearAllMocks()` gets a
// chance to wipe that call history. This is the only way to observe what the real
// module load actually did.
const initialFirestoreInstance = mockGetFirestore.mock.results[0]?.value as
  | { settings: jest.Mock }
  | undefined;
const initialSettingsCalls = initialFirestoreInstance ? [...initialFirestoreInstance.settings.mock.calls] : [];

describe('repository', () => {
  const mockGet = jest.fn();
  const mockSet = jest.fn();
  const mockDoc = jest.fn(() => ({ get: mockGet, set: mockSet }));
  const mockCollection = jest.fn(() => ({ doc: mockDoc }));

  beforeEach(() => {
    jest.clearAllMocks();
    // `settings` stays available on every returned instance (not just the very first,
    // module-load-time one) since the isolateModules-based guard tests below re-require
    // repository.ts, which calls `getFirestore().settings(...)` again against whatever
    // this shared mock currently returns.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetFirestore.mockReturnValue({ collection: mockCollection, settings: jest.fn() } as any);
  });

  describe('getEnrichment', () => {
    test('reads place_enrichment/{canonicalKey} and returns the doc data when it exists', async () => {
      const stored = { name: 'Test Place', lat: 45, lon: -70 };
      mockGet.mockResolvedValue({ exists: true, data: () => stored });

      const result = await getEnrichment('test-place_45.0000_-70.0000');

      expect(mockCollection).toHaveBeenCalledWith('place_enrichment');
      expect(mockDoc).toHaveBeenCalledWith('test-place_45.0000_-70.0000');
      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(result).toEqual(stored);
    });

    test('returns undefined when the doc does not exist', async () => {
      mockGet.mockResolvedValue({ exists: false, data: () => undefined });

      const result = await getEnrichment('missing-key_0.0000_0.0000');

      expect(mockCollection).toHaveBeenCalledWith('place_enrichment');
      expect(mockDoc).toHaveBeenCalledWith('missing-key_0.0000_0.0000');
      expect(result).toBeUndefined();
    });
  });

  describe('writeEnrichment', () => {
    test('writes to place_enrichment/{canonicalKey} with the given data', async () => {
      const data: PlaceEnrichment = {
        name: 'Test Place',
        lat: 45,
        lon: -70,
        address: '123 Main St',
        photos: [],
        cached_at: 1_700_000_000_000,
        place_id_locked: true,
      };
      mockSet.mockResolvedValue(undefined);

      await writeEnrichment('test-place_45.0000_-70.0000', data);

      expect(mockCollection).toHaveBeenCalledWith('place_enrichment');
      expect(mockDoc).toHaveBeenCalledWith('test-place_45.0000_-70.0000');
      expect(mockSet).toHaveBeenCalledWith(data);
    });
  });

  describe('firebase-admin initialization (C1 / C2)', () => {
    // A real Firestore emulator would be the more end-to-end way to verify this, but
    // that's out of scope here (no emulator wired into this project's test setup) —
    // instead these tests directly exercise the actual guard logic (`getApps().length
    // === 0`) and the settings call that repository.ts runs at module scope, either by
    // inspecting the call history from this file's own real import above, or by
    // re-requiring a fresh copy of the module (via jest.isolateModules) against a
    // controllable `firebase-admin/app` mock. These are meaningful tests of the real
    // conditional and its effects, not tautologies: they fail if the guard condition,
    // the calls it makes, or their order regress.

    test('module load calls Firestore.settings with ignoreUndefinedProperties: true', () => {
      expect(initialSettingsCalls).toHaveLength(1);
      expect(initialSettingsCalls[0][0]).toEqual({ ignoreUndefinedProperties: true });
    });

    test('calls initializeApp when no default app exists yet', () => {
      const mockInitializeApp = jest.fn();
      const mockGetApps = jest.fn(() => []);

      jest.isolateModules(() => {
        jest.doMock('firebase-admin/app', () => ({
          initializeApp: mockInitializeApp,
          getApps: mockGetApps,
        }));
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('../src/repository');
      });

      expect(mockGetApps).toHaveBeenCalled();
      expect(mockInitializeApp).toHaveBeenCalledTimes(1);
    });

    test('does not call initializeApp again when a default app already exists', () => {
      const mockInitializeApp = jest.fn();
      const mockGetApps = jest.fn(() => [{ name: '[DEFAULT]' }]);

      jest.isolateModules(() => {
        jest.doMock('firebase-admin/app', () => ({
          initializeApp: mockInitializeApp,
          getApps: mockGetApps,
        }));
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('../src/repository');
      });

      expect(mockGetApps).toHaveBeenCalled();
      expect(mockInitializeApp).not.toHaveBeenCalled();
    });
  });
});
