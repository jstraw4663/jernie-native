jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  getAuthedUser: () => Promise.resolve({ uid: 'test-uid' }),
  database: require('@react-native-firebase/database').default,
}));

import { mockRef, mockUpdate, mockOnce } from '@react-native-firebase/database';
import {
  ensureAnonProfile, writeLinkedProfile, readAnonCreatedAt, updateDisplayName,
  updatePreferredMapsApp,
} from '@/src/lib/userProfile';

beforeEach(() => { jest.clearAllMocks(); });

describe('ensureAnonProfile', () => {
  it('stamps anonCreatedAt and plan on a brand new anonymous uid', async () => {
    mockOnce.mockResolvedValueOnce({ exists: () => false, val: () => null });
    await ensureAnonProfile('uid-1', 1_700_000_000_000);
    expect(mockRef).toHaveBeenCalledWith('users/uid-1/anonCreatedAt');
    expect(mockRef).toHaveBeenCalledWith('users/uid-1');
    expect(mockUpdate).toHaveBeenCalledWith({ anonCreatedAt: 1_700_000_000_000, plan: 'anonymous' });
  });

  // Write-once: initAuth runs on every launch, but only the first one should stamp.
  it('does not rewrite anonCreatedAt when it already exists', async () => {
    mockOnce.mockResolvedValueOnce({ exists: () => true, val: () => 1_600_000_000_000 });
    await ensureAnonProfile('uid-1', 1_700_000_000_000);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('writeLinkedProfile', () => {
  it('flips plan to free and stamps linkedAt', async () => {
    await writeLinkedProfile('uid-1', { displayName: 'Ada', email: 'ada@example.com', now: 42 });
    expect(mockRef).toHaveBeenCalledWith('users/uid-1');
    expect(mockUpdate).toHaveBeenCalledWith({
      plan: 'free', linkedAt: 42, displayName: 'Ada', email: 'ada@example.com',
    });
  });

  // Apple returns fullName/email ONLY on first authorization. A later sign-in returns
  // null for both, and must not erase what we stored the first time.
  it('omits displayName and email when Apple withholds them', async () => {
    await writeLinkedProfile('uid-1', { displayName: null, email: null, now: 42 });
    const patch = mockUpdate.mock.calls[0][0];
    expect(patch).toEqual({ plan: 'free', linkedAt: 42 });
    expect('displayName' in patch).toBe(false);
    expect('email' in patch).toBe(false);
  });

  it('writes displayName without email when the user hides their address', async () => {
    await writeLinkedProfile('uid-1', { displayName: 'Ada', email: null, now: 42 });
    expect(mockUpdate).toHaveBeenCalledWith({ plan: 'free', linkedAt: 42, displayName: 'Ada' });
  });
});

describe('readAnonCreatedAt', () => {
  it('returns the stored timestamp', async () => {
    mockOnce.mockResolvedValueOnce({ exists: () => true, val: () => 1_600_000_000_000 });
    await expect(readAnonCreatedAt('uid-1')).resolves.toBe(1_600_000_000_000);
  });

  it('returns null when absent', async () => {
    mockOnce.mockResolvedValueOnce({ exists: () => false, val: () => null });
    await expect(readAnonCreatedAt('uid-1')).resolves.toBeNull();
  });
});

describe('updateDisplayName', () => {
  it('writes the trimmed name to the user record', async () => {
    await updateDisplayName('uid-1', '  Ada Lovelace  ');
    expect(mockRef).toHaveBeenCalledWith('users/uid-1');
    expect(mockUpdate).toHaveBeenCalledWith({ displayName: 'Ada Lovelace' });
  });

  it('patches only displayName, leaving plan, linkedAt and email untouched', async () => {
    // update(), not set() — the same node holds the anonymous lifecycle marker that drives
    // the save nudge schedule, and a set() here would silently wipe it.
    await updateDisplayName('uid-1', 'Ada');
    expect(mockUpdate.mock.calls[0][0]).toEqual({ displayName: 'Ada' });
  });

  it('rejects an empty or whitespace-only name without writing', async () => {
    // A blank name would render as an empty avatar and an empty row with no way back to a
    // real one, since the edit field would then also be empty.
    await expect(updateDisplayName('uid-1', '   ')).rejects.toThrow();
    await expect(updateDisplayName('uid-1', '')).rejects.toThrow();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('updatePreferredMapsApp', () => {
  it('patches only the self-owned maps preference', async () => {
    await updatePreferredMapsApp('uid-1', 'google');
    expect(mockRef).toHaveBeenCalledWith('users/uid-1');
    expect(mockUpdate).toHaveBeenCalledWith({ preferredMapsApp: 'google' });
  });

  it('removes the preference with null so the chooser returns', async () => {
    await updatePreferredMapsApp('uid-1', null);
    expect(mockUpdate).toHaveBeenCalledWith({ preferredMapsApp: null });
  });
});
