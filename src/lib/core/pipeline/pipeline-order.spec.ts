import { describe, expect, it } from 'vitest';
import { areaHooks } from '$lib/core/prototype/area/hooks.server.js';
import { collectionHooks } from '$lib/core/prototype/collection/hooks.server.js';
import { augmentHooks } from './build.server.js';
import { Hooks } from '$lib/core/pipeline/define-hook.js';

/**
 * What each shape of config actually runs, pinned.
 *
 * The order is written down — `prototype/collection/hooks.server.ts` places every hook a
 * collection can run. What is *computed* is which of them apply: `buildPipeline` keeps a feature's
 * hook only where that feature is enabled. So every sequence below is one list filtered one way,
 * and this file is the record of what each filter leaves.
 *
 * It exists because an edit to those lists reorders the pipeline *silently*. The generated schema
 * stays byte-identical, every adapter probe still matches, and the only symptom is behaviour —
 * which is exactly how a feature once shipped contributing no hooks at all. In `beforeUpdate` the
 * stakes are higher than order: auth's three guards read the caller's submission as sent, and a
 * default filled in above them turns an ordinary update into a 401.
 */

const order = (hooks: unknown, timing: string): string[] =>
  ((hooks as Record<string, { name: string }[]>)[timing] ?? []).map((hook) => hook.name);

const collection = (config: object): unknown =>
  augmentHooks(
    { hooks: collectionHooks },
    {
      type: 'collection',
      slug: 'test',
      ...config
    }
  ).$hooks;

describe('resolved pipeline order', () => {
  describe('a plain collection', () => {
    const hooks = collection({});

    it('reads in the documented order', () => {
      // `setDocumentTitle` tie-breaks after the prototype's own steps, being the `title`
      // feature's hook. Its position is written down in `collection/hooks.server.ts` —
      // `setDocumentLocale` and `setDocumentType` write `locale`/`_type` and read neither.
      expect(order(hooks, 'beforeRead')).toEqual([
        'processDocumentFields',
        'setDocumentLocale',
        'setDocumentType',
        'setDocumentTitle',
        'setDocumentThumbnail',
        'sortDocumentProps'
      ]);
    });

    it('creates and updates in the documented order', () => {
      expect(order(hooks, 'beforeCreate')).toEqual([
        'mergeWithBlankDocument',
        'buildDataConfigMap',
        'setDefaultValues',
        'validateFields'
      ]);
      expect(order(hooks, 'beforeUpdate')).toEqual([
        'getOriginalDocument',
        'buildOriginalDocConfigMap',
        'resolveContentOwner',
        'buildDataConfigMap',
        'setDefaultValues',
        'validateFields'
      ]);
    });

    it('runs no versions hook, because it enables no versions', () => {
      // It used to run `handleNewVersion` here — the feature's hook, on a config with no
      // versions, doing nothing but restating the default `resolveContentOwner` states now. That
      // was the whole reason both prototypes had to list it by name.
      // The whole list, not a sample: `versions` contributes three hooks and a config that does
      // not enable it must get none of them. This is the assertion that fails if a prototype
      // starts listing one by hand again.
      expect(order(hooks, 'beforeUpdate')).not.toContain('defineVersionOperation');
      expect(order(hooks, 'beforeUpdate')).not.toContain('handleNewVersion');
      expect(order(hooks, 'beforeUpdate')).not.toContain('demoteOtherVersions');
    });
  });

  describe('a versioned collection', () => {
    const hooks = collection({ versions: { draft: true } });

    /**
     * The feature's hooks appear by the feature being enabled, and nowhere else.
     *
     * `handleNewVersion` lands exactly where the prototypes used to list it by hand, and every
     * edge holding it there is now declared rather than written down:
     *
     * - after `resolveContentOwner`, whose default it overrides
     * - after `buildOriginalDocConfigMap`, which it reads
     * - before `buildDataConfigMap`, because it reads the submission as sent —
     *   as sent
     *
     * Only the first was declared before. Dropping any of the three moves it, which is what this
     * assertion is for: it is the one hook in the pipeline whose position changes what a document
     * ends up containing rather than merely when something runs.
     */
    it('adds the versions hooks, after the default they override', () => {
      const update = order(hooks, 'beforeUpdate');

      expect(update).toEqual([
        'getOriginalDocument',
        'buildOriginalDocConfigMap',
        'resolveContentOwner',
        'defineVersionOperation',
        'handleNewVersion',
        'buildDataConfigMap',
        'setDefaultValues',
        'validateFields',
        // Last, and unchanged by this move: it reads `data.status` after the defaults are in,
        // which is where it already ran as a feature hook.
        'demoteOtherVersions'
      ]);
      expect(update.indexOf('resolveContentOwner')).toBeLessThan(
        update.indexOf('handleNewVersion')
      );
      expect(update.indexOf('buildOriginalDocConfigMap')).toBeLessThan(
        update.indexOf('handleNewVersion')
      );
      expect(update.indexOf('handleNewVersion')).toBeLessThan(update.indexOf('setDefaultValues'));
      // And the feature's own ordering: its two consumers run after the hook they read.
      expect(update.indexOf('defineVersionOperation')).toBeLessThan(
        update.indexOf('handleNewVersion')
      );
      expect(update.indexOf('defineVersionOperation')).toBeLessThan(
        update.indexOf('demoteOtherVersions')
      );
    });
  });

  describe('an auth collection', () => {
    const hooks = collection({ auth: { type: 'apiKey' } });

    it('strips private fields before anything derives from the document', () => {
      expect(order(hooks, 'beforeRead')[0]).toBe('removePrivateFields');
    });

    it('appends the password field before the config map that must cover it', () => {
      // The one genuinely tight edge in the whole pipeline, and the reason `blank-merged` exists:
      // in beforeCreate the blank document is built from config.fields, so augmenting before the
      // merge gives every create a blank `password` that fails its own required check.
      const create = order(hooks, 'beforeCreate');
      expect(create.indexOf('mergeWithBlankDocument')).toBeLessThan(
        create.indexOf('augmentFieldsPassword')
      );
      expect(create.indexOf('augmentFieldsPassword')).toBeLessThan(
        create.indexOf('buildDataConfigMap')
      );

      // In beforeUpdate nothing merges a blank document, so the same single declaration resolves
      // with its requirement satisfied vacuously and the hook simply runs earlier.
      const update = order(hooks, 'beforeUpdate');
      expect(update.indexOf('augmentFieldsPassword')).toBeLessThan(
        update.indexOf('buildDataConfigMap')
      );
    });

    it('matches the hand-written order exactly', () => {
      expect(order(hooks, 'beforeCreate')).toEqual([
        'mergeWithBlankDocument',
        'augmentFieldsPassword',
        'buildDataConfigMap',
        'setDefaultValues',
        'validateFields',
        'createBetterAuthUser'
      ]);
      expect(order(hooks, 'beforeUpdate')).toEqual([
        'getOriginalDocument',
        'buildOriginalDocConfigMap',
        'resolveContentOwner',
        'augmentFieldsPassword',
        'preventSuperAdminMutation',
        'preventUserMutations',
        'forwardRolesToBetterAuth',
        'buildDataConfigMap',
        'setDefaultValues',
        'validateFields'
      ]);
      expect(order(hooks, 'afterCreate')).toEqual(['populateAPIKey', 'signInNewUser']);
      expect(order(hooks, 'beforeDelete')).toEqual(['preventSupperAdminDeletion']);
      expect(order(hooks, 'afterDelete')).toEqual(['deleteBetterAuthUser']);
    });
  });

  describe('a collection carrying upload, nested and url', () => {
    const hooks = collection({
      upload: { directories: true },
      nested: true,
      $url: () => '/x'
    });

    it('interleaves the features without the prototype naming one', () => {
      // ACCEPTED DIFF vs the hand-written order, which ran url before nested. Neither reads what
      // the other writes — `addChildrenProperty` reads `doc.id` and `config.slug`, `populateURL`
      // reads `doc._parent` and the author's `$url` — so they commute. They now sit in feature
      // list order, which is the tie-break.
      //
      // `setDocumentTitle` before `populateURL` is *not* a tie-break: the features list puts url
      // first, and the list still places title ahead of it because `populateURL` reads
      // `title`. That is the one edge in this timing that a wrong mark would silently invert —
      // `$url` would then build a slug from an undefined title — so it is declared, not inherited.
      expect(order(hooks, 'beforeRead')).toEqual([
        'processDocumentFields',
        'setDocumentLocale',
        'setDocumentType',
        'populateSizes',
        'addChildrenProperty',
        'setDocumentTitle',
        'populateURL',
        'setDocumentThumbnail',
        'sortDocumentProps'
      ]);
    });

    it('sorts last, after every hook that writes to the document', () => {
      const read = order(hooks, 'beforeRead');
      expect(read.at(-1)).toBe('sortDocumentProps');
    });

    it('runs upload write hooks after validation', () => {
      expect(order(hooks, 'beforeCreate')).toEqual([
        'mergeWithBlankDocument',
        'buildDataConfigMap',
        'setDefaultValues',
        'validateFields',
        'handlePathCreation',
        'castBase64ToFile',
        'processFileUpload'
      ]);
      expect(order(hooks, 'beforeDelete')).toEqual(['cleanUpFiles']);
    });
  });

  describe('an area with a url', () => {
    const hooks = (
      augmentHooks({ hooks: areaHooks }, { type: 'area', slug: 'settings', $url: () => '/s' }) as {
        $hooks: unknown;
      }
    ).$hooks;

    it('reads in the documented order', () => {
      // ACCEPTED DIFF vs the hand-written order, which ran url *before* setDocumentType and
      // called that difference from the collection deliberate. It is not: setDocumentType writes
      // `_prototype`/`_type` and populateURL reads neither, so they commute. Both prototypes now
      // resolve the same way, which is the point.
      expect(order(hooks, 'beforeRead')).toEqual([
        'processDocumentFields',
        'setDocumentLocale',
        'setDocumentType',
        'setDocumentTitle',
        'populateURL',
        'sortDocumentProps'
      ]);
    });

    it('has no create, delete or thumbnail step', () => {
      expect(order(hooks, 'beforeCreate')).toEqual([]);
      expect(order(hooks, 'beforeDelete')).toEqual([]);
      expect(order(hooks, 'beforeRead')).not.toContain('setDocumentThumbnail');
    });
  });

  describe('a consumer hook', () => {
    it('runs before the finaliser, so a property it adds comes back sorted', () => {
      // A consumer's hooks are appended after the prototype's list — but `sortDocumentProps` is
      // appended after *them*, because it is a finaliser rather than a participant. That is what
      // keeps a consumer's property in order without letting it interleave.
      const own = Hooks.beforeRead(async (args) => args);
      const hooks = collection({ $hooks: { beforeRead: [own] } });
      const read = order(hooks, 'beforeRead');

      expect(read).toContain('anonymous');
      expect(read.at(-1)).toBe('sortDocumentProps');
      expect(read.indexOf('anonymous')).toBeLessThan(read.indexOf('sortDocumentProps'));
    });

    it('runs even when it bypasses Hooks entirely', () => {
      // A bare function that never went through `Hooks.*` is still a hook: it is appended like any
      // other consumer hook, and the finaliser still follows it.
      const raw = async (args: unknown) => args;
      const read = order(collection({ $hooks: { beforeRead: [raw] } }), 'beforeRead');
      expect(read.at(-2)).toBe('raw');
      expect(read.at(-1)).toBe('sortDocumentProps');
    });
  });
});
