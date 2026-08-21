const mockStore: Record<string, string> = {};
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (k: string) => mockStore[k],
    set: (k: string, v: string) => { mockStore[k] = v; },
    remove: (k: string) => { delete mockStore[k]; },
  }),
}));

import { stageMigration, readStagedMigration, clearStagedMigration } from '@/src/lib/migrationStaging';

beforeEach(() => { Object.keys(mockStore).forEach(k => delete mockStore[k]); });

describe('migrationStaging', () => {
  const payload = {
    fromUid: 'anon-uid',
    trips: [{ tripId: 'trip-a', data: { id: 'trip-a', ownerUid: 'anon-uid' } }],
  };

  it('round-trips a staged migration', () => {
    stageMigration(payload);
    expect(readStagedMigration()).toEqual(payload);
  });

  it('reports nothing staged on a clean device', () => {
    expect(readStagedMigration()).toBeNull();
  });

  it('clears a staged migration', () => {
    stageMigration(payload);
    clearStagedMigration();
    expect(readStagedMigration()).toBeNull();
  });

  // A payload that can never be acted on would otherwise be retried on every single launch.
  it('treats a payload with no trips as nothing staged', () => {
    stageMigration({ fromUid: 'anon-uid', trips: [] });
    expect(readStagedMigration()).toBeNull();
  });

  it('treats a payload with no source uid as nothing staged', () => {
    stageMigration({ fromUid: '', trips: payload.trips });
    expect(readStagedMigration()).toBeNull();
  });

  it('treats corrupt JSON as nothing staged rather than throwing on launch', () => {
    mockStore['pending_migration'] = '{not json';
    expect(readStagedMigration()).toBeNull();
  });
});
