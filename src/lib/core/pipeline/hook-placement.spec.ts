import { describe, expect, it } from 'vitest';
import * as auth from '$lib/core/auth/hooks/index.server.js';
import * as nested from '$lib/core/prototype/collection/nested/hooks/index.server.js';
import * as thumbnail from '$lib/core/prototype/collection/thumbnail/hooks/index.server.js';
import * as title from '$lib/core/prototype/shared/title/hooks/index.server.js';
import * as upload from '$lib/core/prototype/collection/upload/hooks/index.server.js';
import * as url from '$lib/core/prototype/shared/url/hooks/index.server.js';
import * as versions from '$lib/core/versions/hooks/index.server.js';
import { areaHooks } from '$lib/core/prototype/area/hooks.server.js';
import { collectionHooks } from '$lib/core/prototype/collection/hooks.server.js';

/**
 * Every hook a feature owns is placed by at least one prototype.
 *
 * This is the failure a written order trades for the resolver's, and until now nothing checked it.
 * CONTRIBUTING said `buildPipeline` "refuses to boot if a feature contributes a hook no prototype
 * places" — it never did, and it cannot: a feature carries no hook list any more, so at runtime
 * there is nothing to compare a prototype's list against.
 *
 * There is at build time. Each feature's `hooks/index.server.ts` is a barrel that exists to be
 * read — it is what `collection/hooks.server.ts` imports to place them — so the set of hooks a
 * feature owns is exactly what that file exports.
 *
 * An unplaced hook never runs, silently. In `beforeUpdate` that is a security question:
 * `preventUserMutations` and `preventSuperAdminMutation` are auth's, and a hook that is written,
 * exported and never placed looks exactly like one that is enforcing something.
 *
 * A hook deliberately owned but not placed anywhere goes in `unplaced` below, with the reason.
 */
const barrels = { auth, nested, thumbnail, title, upload, url, versions };

/**
 * Hooks a feature exports that no prototype places, on purpose.
 *
 * Empty. Kept as the seam because "we meant that one" is a real answer, and the alternative is
 * deleting the assertion the day it first fires. An entry here asserts the opposite — that the
 * hook is placed **nowhere** — so a stale one fails as loudly as a missing placement.
 */
const unplaced: Record<string, string> = {};

const placed = new Set(
  [collectionHooks, areaHooks].flatMap((byTiming) =>
    Object.values(byTiming).flatMap((hooks) => hooks ?? [])
  )
);

describe('every feature hook is placed by a prototype', () => {
  for (const [feature, barrel] of Object.entries(barrels)) {
    for (const [name, hook] of Object.entries(barrel)) {
      const key = `${feature}.${name}`;

      it(key, () => {
        if (key in unplaced) return expect(placed.has(hook)).toBe(false);
        expect(placed.has(hook)).toBe(true);
      });
    }
  }
});
