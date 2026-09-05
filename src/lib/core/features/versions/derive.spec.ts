import { describe, expect, it } from 'vitest';
import { Hooks } from '$lib/core/pipeline/hooks.js';
import { marksOf } from '$lib/core/pipeline/resolve-pipeline.server.js';
import { resolvePipelines } from '$lib/core/prototype/pipelines.server.js';
import type { Dic } from '$lib/util/types.js';
import { create } from '$lib/core/prototype/collection/definition.js';
import { text } from '$lib/fields/text/index.js';
import { makeVersionsCollectionsAliases } from './derive.server.js';

/**
 * What a versions shadow's pipeline is made of.
 *
 * A shadow is a collection, so it resolves like one: the prototype's own hooks, the hooks of the
 * features **its own** config enables, and the author's `$hooks`. Inheriting the parent's resolved
 * `_pipeline` instead runs hooks for features the shadow does not enable — a versioned + nested
 * collection queries `_parent` on a shadow whose table has never had that column — and stacks the
 * core steps twice when the parent is an area.
 */
describe('a versions shadow', () => {
  const authorHook = Hooks.beforeRead({
    name: 'authorBeforeRead',
    requires: ['shaped'],
    provides: [],
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

  const shadow = built.collections.find(
    (c) => c.slug === '$derive_spec_pages__versions'
  ) as unknown as { $hooks?: Record<string, unknown[]> };

  const beforeRead = (shadow.$hooks?.beforeRead ?? []).map((hook) => marksOf(hook).name);

  it('runs the author’s own hooks', () => {
    expect(beforeRead).toContain('authorBeforeRead');
  });

  it('runs no hook of a feature it does not enable', () => {
    // `nested` is on the parent, never on the shadow: the base row owns the hierarchy.
    expect(beforeRead).not.toContain('addChildrenProperty');
  });

  it('runs each core step once', () => {
    const core = beforeRead.filter((name) => name === 'processDocumentFields');
    expect(core).toHaveLength(1);
  });
});
