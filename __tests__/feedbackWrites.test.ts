jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  getAuthedUser: () => Promise.resolve({ uid: 'test-uid' }),
  database: require('@react-native-firebase/database').default,
}));

import { mockRef, mockSet } from '@react-native-firebase/database';
import { submitFeedback, TITLE_MAX_LENGTH } from '@/src/lib/feedbackWrites';

beforeEach(() => { jest.clearAllMocks(); });

const base = { tripId: 'trip-1', title: 'Hero gradient flickers', priority: 'high' as const };

describe('submitFeedback', () => {
  it('writes to a top-level bug_reports key, not under the trip', async () => {
    // Reports outlive the trip they were filed against — a tester deleting a trip must not
    // delete the evidence of the bug they hit in it.
    await submitFeedback(base);
    const path = mockRef.mock.calls[0][0] as string;
    expect(path).toMatch(/^bug_reports\//);
  });

  it('stamps id, author and createdAt, and echoes the id into the payload', async () => {
    // .validate requires newData.child('id').val() === $reportId, so the id has to appear
    // both in the path and in the body or the write is rejected.
    await submitFeedback(base);
    const path = mockRef.mock.calls[0][0] as string;
    const written = mockSet.mock.calls[0][0];
    expect(written.id).toBe(path.replace('bug_reports/', ''));
    expect(written.author).toBe('test-uid');
    expect(typeof written.createdAt).toBe('number');
  });

  it('sets author to the uid, not a display name', async () => {
    // database.rules.json binds author to auth.uid in both .write and .validate. A display
    // name here is rejected by the server, and only there.
    await submitFeedback(base);
    expect(mockSet.mock.calls[0][0].author).toBe('test-uid');
  });

  it('omits body entirely when none was given', async () => {
    // RTDB rejects an explicit undefined, and .validate only tolerates body when absent or
    // a string — sending undefined fails both.
    await submitFeedback(base);
    expect('body' in mockSet.mock.calls[0][0]).toBe(false);
  });

  it('includes body when given', async () => {
    await submitFeedback({ ...base, body: 'Only on the Bar Harbor stop.' });
    expect(mockSet.mock.calls[0][0].body).toBe('Only on the Bar Harbor stop.');
  });

  it('omits order — nothing reads bug_reports in-app, so there is nothing to order', async () => {
    await submitFeedback(base);
    expect('order' in mockSet.mock.calls[0][0]).toBe(false);
  });

  it('trims the title and rejects a blank one without writing', async () => {
    await submitFeedback({ ...base, title: '  Padded  ' });
    expect(mockSet.mock.calls[0][0].title).toBe('Padded');
    mockSet.mockClear();
    await expect(submitFeedback({ ...base, title: '   ' })).rejects.toThrow();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('rejects a title longer than the server will accept, rather than letting RTDB do it', async () => {
    // The server rejects >200 with a bare permission error the user cannot act on. Failing
    // here lets the sheet say what is actually wrong.
    await expect(submitFeedback({ ...base, title: 'x'.repeat(TITLE_MAX_LENGTH + 1) })).rejects.toThrow();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('accepts a title exactly at the limit', async () => {
    await submitFeedback({ ...base, title: 'x'.repeat(TITLE_MAX_LENGTH) });
    expect(mockSet).toHaveBeenCalled();
  });

  it('exports the same title bound the rules enforce', () => {
    // If these drift, the sheet accepts a report the server rejects with no useful message.
    expect(TITLE_MAX_LENGTH).toBe(200);
  });
});
