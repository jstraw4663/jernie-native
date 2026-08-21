import { database, getAuthedUser } from '@/src/lib/firebase';
import { generateId } from '@/src/utils/id';
import { stripUndefined } from '@/src/utils/stripUndefined';
import type { BugPriority, BugReport } from '@/src/types';

/**
 * Mirrors the bound in database.rules.json's bug_reports .validate. Exported so
 * FeedbackSheet caps its input at the same number — if the two drift, the sheet accepts a
 * report the server rejects with a bare permission error the user cannot act on.
 */
export const TITLE_MAX_LENGTH = 200;

export interface NewBugReport {
  tripId: string;
  title: string;
  body?: string;
  priority: BugPriority;
}

/**
 * Files a bug report. Reports live at the RTDB root rather than under the trip: they outlive
 * the trip they were filed against, and a tester deleting a trip must not delete the evidence
 * of the bug they hit in it.
 *
 * Create-only by rule — there is no update or delete counterpart, deliberately.
 */
export async function submitFeedback(input: NewBugReport): Promise<void> {
  const title = input.title.trim();
  if (!title) throw new Error('Give the report a title');
  // Checked here rather than left to the server, which answers an over-long title with a
  // permission error that says nothing about length.
  if (title.length > TITLE_MAX_LENGTH) {
    throw new Error(`Keep the title under ${TITLE_MAX_LENGTH} characters`);
  }

  const user = await getAuthedUser();
  const id = generateId();

  const report: Omit<BugReport, 'order'> = {
    id,
    tripId: input.tripId,
    title,
    // Trimmed to undefined rather than '' so stripUndefined drops the key entirely —
    // .validate tolerates body being absent or a string, never an empty write of undefined.
    body: input.body?.trim() || undefined,
    priority: input.priority,
    // The uid, not a display name: .write and .validate both bind author to auth.uid.
    author: user.uid,
    createdAt: Date.now(),
  };

  // The id is echoed into the body as well as the path because .validate asserts
  // newData.child('id').val() === $reportId.
  await database().ref(`bug_reports/${id}`).set(stripUndefined(report));
}
