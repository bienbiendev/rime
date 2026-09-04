import { describe, expect, it } from 'vitest';
import { area } from '$lib/core/prototype/area/definition.server.js';
import { collection as collectionPrototype } from '$lib/core/prototype/collection/definition.server.js';
import { augmentHooks } from './build-pipeline.server.js';
import { Hooks } from '$lib/core/pipeline/hooks.js';

/**
 * The order the pipeline resolves to, pinned.
 *
 * Every sequence below is the order a real config resolves to: the prototype declares its own
 * hooks and lists the features that extend it, `augmentHooks` composes the two, and the resolver
 * sorts them by the marks each declares. Any accepted departure from the obvious reading is
 * marked in place, checked against the hooks rather than assumed.
 *
 * This file exists because a wrong mark reorders the pipeline *silently*. The generated schema
 * stays byte-identical, every adapter probe still matches, and the only symptom is behaviour —
 * which is exactly how a feature once shipped contributing no hooks at all. Nothing else in the
 * suite would catch it.
 */

const order = (hooks: unknown, timing: string): string[] =>
  ((hooks as Record<string, { name: string }[]>)[timing] ?? []).map((hook) => hook.name);

const collection = (config: object): unknown =>
  augmentHooks(collectionPrototype, {
    type: 'collection',
    slug: 'test',
    ...config
  })._pipeline;

describe('resolved pipeline order', () => {
  describe('a plain collection', () => {
    const hooks = collection({});

    it('reads in the documented order', () => {
      // `setDocumentTitle` tie-breaks after the prototype's own steps, being the `title`
      // feature's hook. Its position is free rather than incidental: it requires `shaped` and
      // provides `title`/`document`, and nothing it passes provides or consumes either —
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
        'defineVersionOperation',
        'getOriginalDocument',
        'buildOriginalDocConfigMap',
        'handleNewVersion',
        'buildDataConfigMap',
        'setDefaultValues',
        'validateFields'
      ]);
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
        'defineVersionOperation',
        'getOriginalDocument',
        'buildOriginalDocConfigMap',
        'handleNewVersion',
        'augmentFieldsPassword',
        'preventSuperAdminMutation',
        'preventUserMutations',
        'forwardRolesToBetterAuth',
        'buildDataConfigMap',
        'setDefaultValues',
        'validateFields'
      ]);
      expect(order(hooks, 'afterCreate')).toEqual(['populateAPIKey']);
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
      // first, and the resolver still orders title ahead of it because `populateURL` requires
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
      augmentHooks(area, { type: 'area', slug: 'settings', $url: () => '/s' }) as {
        _pipeline: unknown;
      }
    )._pipeline;

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
    it('is sorted rather than appended after the built-ins', () => {
      // A consumer's beforeRead hook carries default marks that place it before the sort, so a
      // property it adds comes back in order like any other.
      const own = Hooks.beforeRead(async (args) => args);
      const hooks = collection({ $hooks: { beforeRead: [own] } });
      const read = order(hooks, 'beforeRead');

      expect(read).toContain('anonymous');
      expect(read.at(-1)).toBe('sortDocumentProps');
      expect(read.indexOf('anonymous')).toBeLessThan(read.indexOf('sortDocumentProps'));
    });

    it('keeps its input position when it bypasses Hooks entirely', () => {
      // A bare function that never went through `Hooks.*` carries no marks, so it constrains
      // nothing and simply stays where it was put. Saying nothing has to mean nothing.
      const raw = async (args: unknown) => args;
      const hooks = collection({ $hooks: { beforeRead: [raw] } });
      expect(order(hooks, 'beforeRead').at(-1)).toBe('raw');
    });
  });
});
