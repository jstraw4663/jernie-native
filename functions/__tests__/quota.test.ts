import { HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import {
  planCharge,
  dayKey,
  minuteBucketKey,
  quotaDocId,
  globalDocId,
  quotaExpiresAt,
  resolveLimit,
  chargeQuota,
  GLOBAL_USAGE_KEY,
  type EndpointUsage,
} from '../src/quota';

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => ({ settings: jest.fn() })),
}));

const mockGetFirestore = getFirestore as jest.MockedFunction<typeof getFirestore>;

const LIMITS = { day: 10, minute: 4 };
const BUCKET = '2026-08-26T14:03';

function usage(over: Partial<EndpointUsage> = {}): EndpointUsage {
  return { day: 0, minuteBucket: BUCKET, minute: 0, ...over };
}

// ── The pure planner ─────────────────────────────────────────────────────────
describe('planCharge', () => {
  test('a first charge starts both counters and stamps the bucket', () => {
    const plan = planCharge(undefined, 1, BUCKET, LIMITS);

    expect(plan).toEqual({ ok: true, usage: { day: 1, minuteBucket: BUCKET, minute: 1 } });
  });

  test('charges accumulate within the same minute', () => {
    const plan = planCharge(usage({ day: 3, minute: 2 }), 1, BUCKET, LIMITS);

    expect(plan).toMatchObject({ ok: true, usage: { day: 4, minute: 3 } });
  });

  // The day counter is the budget; the minute counter is only ever a burst brake.
  test('a new minute resets the burst counter but never the daily one', () => {
    const plan = planCharge(usage({ day: 7, minute: 4 }), 1, '2026-08-26T14:04', LIMITS);

    expect(plan).toMatchObject({ ok: true, usage: { day: 8, minute: 1, minuteBucket: '2026-08-26T14:04' } });
  });

  test('spending exactly up to the limit is allowed', () => {
    expect(planCharge(usage({ day: 9, minute: 3 }), 1, BUCKET, LIMITS)).toMatchObject({ ok: true });
  });

  test('denies once the day budget would be exceeded', () => {
    const plan = planCharge(usage({ day: 10, minute: 0 }), 1, BUCKET, LIMITS);

    expect(plan).toEqual({ ok: false, window: 'day', limit: 10, used: 10 });
  });

  test('denies a burst even with day budget to spare', () => {
    const plan = planCharge(usage({ day: 0, minute: 4 }), 1, BUCKET, LIMITS);

    expect(plan).toEqual({ ok: false, window: 'minute', limit: 4, used: 4 });
  });

  // Partial fulfilment would charge for calls the caller is then told it cannot make.
  test('a batch that does not fit is denied whole, not trimmed', () => {
    const plan = planCharge(usage({ day: 8 }), 5, BUCKET, LIMITS);

    expect(plan).toMatchObject({ ok: false, window: 'day' });
  });

  // A real footgun: enrichPlaces charges one unit per place, up to its 30-place batch cap,
  // so a per-minute limit below that batch size would reject every full batch forever
  // rather than merely slowing it down. The per-minute limits must exceed the batch cap.
  test('a batch larger than the whole burst allowance can never pass', () => {
    expect(planCharge(undefined, 5, BUCKET, LIMITS)).toMatchObject({ ok: false, window: 'minute' });
  });
});

// ── Keys ─────────────────────────────────────────────────────────────────────
describe('bucket keys', () => {
  // UTC throughout: a local-timezone boundary would move with the deployment region and
  // silently hand a user a second daily budget when the region changed.
  test('the day key is UTC, not local', () => {
    expect(dayKey(new Date('2026-08-26T23:30:00Z'))).toBe('2026-08-26');
    expect(dayKey(new Date('2026-08-27T00:30:00Z'))).toBe('2026-08-27');
  });

  test('the minute key resolves to the minute', () => {
    expect(minuteBucketKey(new Date('2026-08-26T14:03:59Z'))).toBe('2026-08-26T14:03');
    expect(minuteBucketKey(new Date('2026-08-26T14:04:00Z'))).toBe('2026-08-26T14:04');
  });

  test('a user document is scoped to one uid and one day', () => {
    expect(quotaDocId('uid-jeremy', new Date('2026-08-26T14:03:00Z'))).toBe('u_uid-jeremy_2026-08-26');
  });

  // Distinct prefixes rather than a reserved-looking name: Firestore rejects any document
  // id matching __.*__, so the obvious "__global__" spelling is a trap. These two spaces
  // cannot intersect whatever a uid turns out to look like.
  test('the global document cannot collide with a uid document', () => {
    expect(globalDocId(new Date('2026-08-26T14:03:00Z'))).toBe('g_2026-08-26');
  });

  // Written as a Date so the Admin SDK stores a real Timestamp — Firestore TTL policies
  // only act on Timestamp fields, which is exactly why route_cache's epoch-millis cachedAt
  // cannot be expired by one.
  test('the expiry is a Date safely past the end of the day it covers', () => {
    const expires = quotaExpiresAt(new Date('2026-08-26T14:03:00Z'));

    expect(expires).toBeInstanceOf(Date);
    expect(expires.getTime()).toBeGreaterThan(new Date('2026-08-27T00:00:00Z').getTime());
  });
});

// ── Limit resolution ─────────────────────────────────────────────────────────
// IntParam.runtimeValue() is `parseInt(process.env[NAME] || "0", 10) || 0` — the declared
// default is baked into the deploy spec, never read at runtime. An unmaterialised param
// therefore resolves to 0, and a limit of 0 under fail-closed semantics denies every
// request and takes the app down. The floor below is what stops that.
describe('resolveLimit', () => {
  test('uses the deployed value when one is set', () => {
    expect(resolveLimit({ value: () => 250 }, 300)).toBe(250);
  });

  test('falls back to the built-in when the param resolves to zero', () => {
    expect(resolveLimit({ value: () => 0 }, 300)).toBe(300);
  });

  test('falls back rather than trusting a negative value', () => {
    expect(resolveLimit({ value: () => -5 }, 300)).toBe(300);
  });
});

// ── The transaction ──────────────────────────────────────────────────────────
describe('chargeQuota', () => {
  const NOW = new Date('2026-08-26T14:03:00Z');
  const mockSet = jest.fn();
  const mockGetAll = jest.fn();
  const mockDoc = jest.fn((id: string) => ({ id }));
  const mockCollection = jest.fn(() => ({ doc: mockDoc }));
  const mockRunTransaction = jest.fn();

  function snapshot(data: unknown) {
    return { exists: data !== undefined, data: () => data };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAll.mockResolvedValue([snapshot(undefined), snapshot(undefined)]);
    mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) =>
      fn({ getAll: mockGetAll, set: mockSet }),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetFirestore.mockReturnValue({
      collection: mockCollection,
      runTransaction: mockRunTransaction,
      settings: jest.fn(),
    } as any);
  });

  test('charges the user and the global ledger in one transaction', async () => {
    await chargeQuota('uid-jeremy', 'resolveQuery', 1, NOW);

    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    expect(mockCollection).toHaveBeenCalledWith('api_quota');
    expect(mockSet).toHaveBeenCalledTimes(2);
  });

  // Both counters in ONE transaction, so they can never drift: a global rejection must
  // leave no per-user charge behind, and vice versa.
  test('reads both documents in a single round trip', async () => {
    await chargeQuota('uid-jeremy', 'resolveQuery', 1, NOW);

    expect(mockGetAll).toHaveBeenCalledTimes(1);
    expect(mockGetAll.mock.calls[0].map((r: { id: string }) => r.id)).toEqual([
      'u_uid-jeremy_2026-08-26',
      'g_2026-08-26',
    ]);
  });

  test('merges, so charging one endpoint never clears another', async () => {
    await chargeQuota('uid-jeremy', 'resolveQuery', 1, NOW);

    expect(mockSet.mock.calls[0][2]).toEqual({ merge: true });
    expect(mockSet.mock.calls[0][1]).toMatchObject({
      usage: { resolveQuery: { day: 1, minute: 1, minuteBucket: '2026-08-26T14:03' } },
    });
  });

  test('the global ledger pools every endpoint under one key', async () => {
    await chargeQuota('uid-jeremy', 'routeBetween', 1, NOW);

    expect(mockSet.mock.calls[1][1]).toMatchObject({
      usage: { [GLOBAL_USAGE_KEY]: { day: 1 } },
    });
  });

  test('charges one unit per place for a batch', async () => {
    await chargeQuota('uid-jeremy', 'enrichPlaces', 12, NOW);

    expect(mockSet.mock.calls[0][1]).toMatchObject({
      usage: { enrichPlaces: { day: 12, minute: 12 } },
    });
  });

  test('stamps a Date expiry so a TTL policy can reap the document', async () => {
    await chargeQuota('uid-jeremy', 'resolveQuery', 1, NOW);

    expect(mockSet.mock.calls[0][1].expiresAt).toBeInstanceOf(Date);
  });

  describe('when the budget is gone', () => {
    beforeEach(() => {
      process.env.QUOTA_RESOLVE_QUERY_DAY = '2';
      process.env.QUOTA_RESOLVE_QUERY_MINUTE = '2';
    });

    afterEach(() => {
      delete process.env.QUOTA_RESOLVE_QUERY_DAY;
      delete process.env.QUOTA_RESOLVE_QUERY_MINUTE;
    });

    test('rejects with resource-exhausted, which tells the client to stop retrying', async () => {
      mockGetAll.mockResolvedValue([
        snapshot({ usage: { resolveQuery: { day: 2, minuteBucket: '2026-08-26T14:03', minute: 0 } } }),
        snapshot(undefined),
      ]);

      await expect(chargeQuota('uid-jeremy', 'resolveQuery', 1, NOW)).rejects.toMatchObject({
        code: 'resource-exhausted',
      });
    });

    test('writes nothing at all when it rejects', async () => {
      mockGetAll.mockResolvedValue([
        snapshot({ usage: { resolveQuery: { day: 2, minuteBucket: '2026-08-26T14:03', minute: 0 } } }),
        snapshot(undefined),
      ]);

      await expect(chargeQuota('uid-jeremy', 'resolveQuery', 1, NOW)).rejects.toThrow();
      expect(mockSet).not.toHaveBeenCalled();
    });
  });

  test('the global ceiling stops a user who is well inside their own budget', async () => {
    process.env.QUOTA_GLOBAL_DAY = '5';
    mockGetAll.mockResolvedValue([
      snapshot(undefined),
      snapshot({ usage: { [GLOBAL_USAGE_KEY]: { day: 5, minuteBucket: '2026-08-26T14:03', minute: 0 } } }),
    ]);

    await expect(chargeQuota('uid-jeremy', 'resolveQuery', 1, NOW)).rejects.toMatchObject({
      code: 'resource-exhausted',
    });
    expect(mockSet).not.toHaveBeenCalled();

    delete process.env.QUOTA_GLOBAL_DAY;
  });

  // Fail closed. A quota that can be stepped around by inducing an error is not a spend
  // ceiling — and the failure most likely to happen is write contention on the global
  // document, which arrives precisely when traffic is heaviest.
  describe('when the ledger itself fails', () => {
    test('the billed call is refused, not waved through', async () => {
      mockRunTransaction.mockRejectedValue(new Error('firestore unavailable'));

      await expect(chargeQuota('uid-jeremy', 'resolveQuery', 1, NOW)).rejects.toBeInstanceOf(HttpsError);
    });

    test('the refusal is unavailable, not resource-exhausted, so retrying is correct', async () => {
      mockRunTransaction.mockRejectedValue(new Error('firestore unavailable'));

      await expect(chargeQuota('uid-jeremy', 'resolveQuery', 1, NOW)).rejects.toMatchObject({
        code: 'unavailable',
      });
    });
  });
  // a client should not be pattern-matching it. `details` carries the distinction as data.
  describe('chargeQuota — what a refusal tells the client', () => {
    test('a personal refusal is marked as the user\'s own', async () => {
      mockGetAll.mockResolvedValue([
        snapshot({ usage: { resolveQuery: { day: 300, minuteBucket: '2026-08-26T14:03', minute: 0 } } }),
        snapshot(undefined),
      ]);

      await expect(chargeQuota('uid-jeremy', 'resolveQuery', 1, NOW)).rejects.toMatchObject({
        code: 'resource-exhausted',
        details: { scope: 'user' },
      });
    });

    test('a global refusal is marked as the service being at capacity', async () => {
      mockGetAll.mockResolvedValue([
        snapshot(undefined),
        snapshot({ usage: { all: { day: 3000, minuteBucket: '2026-08-26T14:03', minute: 0 } } }),
      ]);

      await expect(chargeQuota('uid-jeremy', 'resolveQuery', 1, NOW)).rejects.toMatchObject({
        code: 'resource-exhausted',
        details: { scope: 'global' },
      });
    });

    test('a ledger failure is not dressed up as either', async () => {
      mockRunTransaction.mockRejectedValue(new Error('Firestore unavailable'));

      await expect(chargeQuota('uid-jeremy', 'resolveQuery', 1, NOW)).rejects.toMatchObject({
        code: 'unavailable',
      });
    });
  });
});

// The code alone cannot tell a caller whether THEY are out of budget or the whole service
// is, and those need different words on screen — "you've hit your limit today" versus
// "we're at capacity". The message says which, but a message is prose meant for humans and
