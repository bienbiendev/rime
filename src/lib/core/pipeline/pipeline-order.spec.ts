import { describe, expect, it } from 'vitest';
import { areaHooks } from '$lib/core/prototype/area/hooks.server.js';
import { collectionHooks } from '$lib/core/prototype/collection/hooks.server.js';
import { augmentHooks } from './build.server.js';

/**
 * The order each prototype runs its hooks in, pinned.
 *
 * It exists because an edit to a prototype's `hooks.server.ts` reorders the pipeline **silently**.
 * The generated schema stays byte-identical, every adapter probe still matches, and the only
 * symptom is behaviour — which is exactly how a feature once shipped contributing no hooks at all.
 *
 * In `beforeUpdate` the stakes are higher than order: auth's three guards read the caller's
 * submission *as sent*, and a default filled in above them turns an ordinary update into a 401.
 *
 * **One order, not one per config shape.** Every config's pipeline is the same sequence, and
 * `when(isAuth, …)` decides at the call whether a hook applies. That a feature's hook *is* guarded
 * is asserted in `hook-placement.spec.ts`.
 */

const order = (hooks: unknown, timing: string): string[] =>
  ((hooks as Record<string, { name: string }[]>)[timing] ?? []).map((hook) => hook.name);

const pipelineOf = (hooks: object, config: object): unknown =>
  augmentHooks({ hooks }, { slug: 'test', ...config }).$hooks;

describe('a collection runs its hooks in this order', () => {
  const hooks = pipelineOf(collectionHooks, { type: 'collection' });

  it('beforeRead', () => {
    expect(order(hooks, 'beforeRead')).toEqual([
      'removePrivateFields',
      'processDocumentFields',
      'setDocumentLocale',
      'setDocumentType',
      'populateSizes',
      'addChildrenProperty',
      'exposeVersionId',
      'setDocumentTitle',
      'populateURL',
      'setDocumentThumbnail',
      // Appended by `buildPipeline`, after the consumer's own: nothing may follow the finaliser.
      'sortDocumentProps'
    ]);
  });

  it('beforeCreate', () => {
    expect(order(hooks, 'beforeCreate')).toEqual([
      'mergeWithBlankDocument',
      'augmentFieldsPassword',
      'buildDataConfigMap',
      'setDefaultValues',
      'validateFields',
      'createBetterAuthUser',
      'handlePathCreation',
      'castBase64ToFile',
      'processFileUpload'
    ]);
  });

  it('beforeUpdate — auth reads the submission as sent, so its three guards run above the defaults', () => {
    expect(order(hooks, 'beforeUpdate')).toEqual([
      'getOriginalDocument',
      'buildOriginalDocConfigMap',
      'resolveContentOwner',
      'augmentFieldsPassword',
      'preventSuperAdminMutation',
      'preventUserMutations',
      'forwardRolesToBetterAuth',
      'defineVersionOperation',
      'handleNewVersion',
      'buildDataConfigMap',
      'setDefaultValues',
      'validateFields',
      'handlePathCreation',
      'castBase64ToFile',
      'processFileUpload',
      'demoteOtherVersions'
    ]);
  });

  it('the rest', () => {
    expect(order(hooks, 'beforeOperation')).toEqual(['authorize']);
    expect(order(hooks, 'afterCreate')).toEqual(['populateAPIKey', 'signInNewUser']);
    expect(order(hooks, 'beforeDelete')).toEqual(['preventSupperAdminDeletion', 'cleanUpFiles']);
    expect(order(hooks, 'afterDelete')).toEqual(['deleteBetterAuthUser']);
  });
});

describe('an area runs fewer, in the same relative order', () => {
  const hooks = pipelineOf(areaHooks, { type: 'area' });

  it('beforeRead', () => {
    expect(order(hooks, 'beforeRead')).toEqual([
      'processDocumentFields',
      'setDocumentLocale',
      'setDocumentType',
      'exposeVersionId',
      'setDocumentTitle',
      'populateURL',
      'sortDocumentProps'
    ]);
  });

  it('beforeUpdate', () => {
    expect(order(hooks, 'beforeUpdate')).toEqual([
      'getOriginalDocument',
      'buildOriginalDocConfigMap',
      'resolveContentOwner',
      'defineVersionOperation',
      'handleNewVersion',
      'buildDataConfigMap',
      'setDefaultValues',
      'validateFields',
      'demoteOtherVersions'
    ]);
  });

  it('has no create and no delete: a second row is not a thing', () => {
    expect(order(hooks, 'beforeCreate')).toEqual([]);
    expect(order(hooks, 'afterCreate')).toEqual([]);
    expect(order(hooks, 'beforeDelete')).toEqual([]);
    expect(order(hooks, 'afterDelete')).toEqual([]);
  });
});
