import { metas } from '$lib/core/features/metas/index.js';
import { title } from '$lib/core/features/title/index.js';
import { url } from '$lib/core/features/url/index.js';
import { versions } from '$lib/core/features/versions/index.js';
import { definePrototype } from '../define.js';

/**
 * An area is a prototype with the singleton flag on: exactly one document, so create and delete
 * are off, and reads and updates need no id to say which one they mean.
 *
 * The client half of the pair — what an area *is*. `api`, `rest` and `boot` are server-only and
 * live in `module.server.ts`.
 */
export const areaFeatures = [versions, url, title, metas] as const;

export const area = definePrototype({
  singleton: true,

  /**
   * In augment order, which is column order. No `auth`, `upload`, `nested` or `thumbnail`: an
   * area is one document, so there is nothing to sign in as, nothing listing it, and nothing for
   * it to be nested in. It simply does not list them — where it used to be each of those
   * features declaring `extends: ['collection']` about somebody else.
   */
  features: [...areaFeatures]
});
