import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { retireAutoSaves } from '../retire-auto-saves.server.js';

/**
 * A staff member's auto-saved rows go with them.
 *
 * Runs on the staff collection's delete, before the row is gone: the foreign key would set
 * `updatedBy` to null and leave a row nobody owns and nobody can resume. Every config that
 * auto-saves is swept.
 */
export const discardAutoSavesOf = Hooks.beforeDelete(async function discardAutoSavesOf(args) {
  const { event, doc } = args;
  const { config } = event.locals.rime;

  for (const prototype of [...Object.values(config.collections), ...Object.values(config.areas)]) {
    await retireAutoSaves({ event, config: prototype, userId: doc.id });
  }

  return args;
});
