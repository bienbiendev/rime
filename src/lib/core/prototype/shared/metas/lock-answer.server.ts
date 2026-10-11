import type { BuiltPrototype } from '#lib/core/prototype/define.js';
import type { GenericDoc } from '#lib/core/prototype/types.js';
import { type RequestEvent } from '@sveltejs/kit';
import { claimEditLock, releaseEditLock } from './lock.server.js';

/**
 * Claims or releases the edit lock on `doc` and answers `{ held }`.
 *
 * `held` is the answer, not a failure: a heartbeat that lost the document renders that, so
 * somebody else holding it is an ordinary 200.
 */
export const answerLock = async (args: {
  event: RequestEvent;
  intent: 'claim' | 'release';
  config: BuiltPrototype;
  doc: GenericDoc;
  userId: string;
}) => {
  const { event, intent, config, doc, userId } = args;
  // A `pagehide` beacon can only POST, so a release arriving that way says so in the query.
  // DELETE stays the method for every release that has time to pick one.
  const releasing = intent === 'release' || event.url.searchParams.get('release') === 'true';
  const force = !releasing && event.url.searchParams.get('force') === 'true';
  const lockArgs = { event, config, doc, userId, force };

  let held = false;
  if (releasing) {
    await releaseEditLock(lockArgs);
  } else {
    held = await claimEditLock(lockArgs);
  }
  return Response.json({ held: !!held });
};
