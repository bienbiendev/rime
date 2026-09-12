import { Hooks } from '$lib/core/pipeline/define-hook.js';

/**
 * Drops `isAutoSave` from the submission. The server sets it; a request body cannot.
 *
 * `hidden()` is a panel concern only — any hidden field is writable through a request body, so
 * a flag the server owns has to be taken out before anything reads the data.
 */
export const stripAutoSaveFlag = Hooks.beforeUpsert(async function stripAutoSaveFlag(args) {
  if (!('isAutoSave' in args.data)) return args;

  const data = { ...args.data };
  delete data.isAutoSave;

  return { ...args, data };
});
