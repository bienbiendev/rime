import { describe, expect, it } from 'vitest';
import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { hookName } from '$lib/core/pipeline/hook-name.server.js';
import { resolvePipelines } from '$lib/core/pipeline/build.server.js';
import type { Dic } from '$lib/util/types.js';
import { create } from '$lib/core/prototype/collection/definition.js';
import { text } from '$lib/fields/text/index.js';
import { makeVersionsCollectionsAliases } from './derive.server.js';

/**
 * What a versions versions's pipeline is made of.
 *
 * A versions is a collection, so it resolves like one: the prototype's own hooks, the hooks of the
 * features **its own** config enables, and the author's `$hooks`. Inheriting the parent's resolved
 * `_pipeline` instead runs hooks for features the versions does not enable — a versioned + nested
 * collection queries `_parent` on a versions whose table has never had that column — and stacks the
 * core steps twice when the parent is an area.
 */
describe('a versions versions', () => {
  const authorHook = Hooks.beforeRead({
    name: 'authorBeforeRead',
    run: async (args) => args
  });

  const parent = create('derive_spec_pages', {
    fields: [text('title').isTitle()],
    nested: true,
    versions: { draft: true },
    $hooks: { beforeRead: [authorHook] }
  });

  // The real order: derive first, resolve every pipeline after — as the config chain does.
  const config = { collections: [parent] } as never;
  makeVersionsCollectionsAliases(config);
  const built = resolvePipelines(config as { collections: Dic[] });

  const versions = built.collections.find(
    (c) => c.slug === '$derive_spec_pages__versions'
  ) as unknown as { $hooks?: Record<string, unknown[]> };

  const beforeRead = (versions.$hooks?.beforeRead ?? []).map((hook) => hookName(hook));

  it('runs the author’s own hooks', () => {
    expect(beforeRead).toContain('authorBeforeRead');
  });

  it('runs no hook of a feature it does not enable', () => {
    // `nested` is on the parent, never on the versions: the base row owns the hierarchy.
    expect(beforeRead).not.toContain('addChildrenProperty');
  });

  it('runs each core step once', () => {
    const core = beforeRead.filter((name) => name === 'processDocumentFields');
    expect(core).toHaveLength(1);
  });
});

/**
 * A versions says whose content it holds.
 *
 * `upload`'s naming used to answer that question by string surgery — `withoutVersionsSuffix(slug)`,
 * so a versions's directories resolved to its parent's. It was the only feature-to-feature import in
 * the registry, and it could only ever know about the one feature whose suffix it stripped.
 *
 * What upload does with the answer is asserted in `upload/naming.spec.ts`, against a plain object
 * rather than against this feature — which is the point: neither spec names the other.
 */
describe('_shadowOf', () => {
  const versionedUpload = create('spec_owner_medias', {
    versions: true,
    upload: true,
    fields: [text('alt')]
  });

  const shadowOfVersioned = () => {
    const config = makeVersionsCollectionsAliases({ collections: [versionedUpload] } as any);
    return config.collections!.find((c: Dic) => c.slug !== versionedUpload.slug)!;
  };

  it('names the config the versions holds the content of', () => {
    expect((shadowOfVersioned() as Dic)._shadowOf).toBe('spec_owner_medias');
  });

  it('leaves the authored config saying nothing, so it is its own owner', () => {
    expect((versionedUpload as unknown as Dic)._shadowOf).toBeUndefined();
  });
});
