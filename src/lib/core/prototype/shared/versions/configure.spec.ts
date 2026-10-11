import { describe, expect, it } from 'vitest';
import { Hooks } from '#lib/core/pipeline/define-hook.js';
import { resolvePipelines } from '#lib/core/pipeline/build.server.js';
import type { Dic } from '#lib/util/types.js';
import { create } from '#lib/core/prototype/collection/definition.js';
import { text } from '#lib/fields/text/index.js';
import { configureVersions } from './configure.server.js';

/**
 * What a versions table versions's pipeline is made of.
 *
 * A versions is a collection, so it resolves like one: the prototype's own hooks, the hooks of the
 * features **its own** config enables, and the author's `$hooks`. Inheriting the parent's resolved
 * `_pipeline` instead runs hooks for features the versions table does not enable — a versioned + nested
 * collection queries `_parent` on a versions table whose table has never had that column — and stacks the
 * core steps twice when the parent is an area.
 */
describe('a versions versions', () => {
  const authorHook = Hooks.beforeRead(async function authorBeforeRead(args) {
    return args;
  });

  const parent = create('derive_spec_pages', {
    fields: [text('title').isTitle()],
    nested: true,
    versions: { draft: true },
    $hooks: { beforeRead: [authorHook] }
  });

  // The real order: derive first, resolve every pipeline after — as the config chain does.
  const config = { collections: [parent] } as never;
  configureVersions(config);
  const built = resolvePipelines(config as { collections: Dic[] });

  const versions = built.collections.find(
    (c) => c.slug === '$derive_spec_pages__versions'
  ) as unknown as { $hooks?: Record<string, unknown[]> };

  const entries = (versions.$hooks?.beforeRead ?? []) as ((args: unknown) => unknown)[];
  const beforeRead = entries.map((hook) => hook.name);

  it('runs the author’s own hooks', () => {
    expect(beforeRead).toContain('authorBeforeRead');
  });

  /**
   * `nested` is on the parent, never on the versions table: the base row owns the hierarchy.
   *
   * The list *places* `addChildrenProperty` — every config's pipeline is the same sequence — so
   * what has to hold is that the guard beside it says no. Asserted by running the entry: a guard
   * that does not apply hands its argument straight back, untouched and unawaited.
   */
  it('does not run a hook whose guard this config fails', () => {
    const index = beforeRead.indexOf('addChildrenProperty');
    expect(index).toBeGreaterThan(-1);

    const args = { config: versions, doc: {} };
    expect(entries[index](args)).toBe(args);
  });

  it('runs each core step once', () => {
    const core = beforeRead.filter((name) => name === 'processDocumentFields');
    expect(core).toHaveLength(1);
  });
});

/**
 * A versions says whose content it holds.
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
    const config = configureVersions({ collections: [versionedUpload] } as any);
    return config.collections!.find((c: Dic) => c.slug !== versionedUpload.slug)!;
  };

  it('names the config the versions holds the content of', () => {
    expect((shadowOfVersioned() as Dic)._shadowOf).toBe('spec_owner_medias');
  });

  it('leaves the authored config saying nothing, so it is its own owner', () => {
    expect((versionedUpload as unknown as Dic)._shadowOf).toBeUndefined();
  });
});

describe('the versions access', () => {
  const anyone = () => true;
  const parent = create('access_spec_news', {
    fields: [text('title').isTitle()],
    versions: { draft: true },
    access: { create: anyone, read: anyone, update: anyone, delete: anyone }
  });
  const config = { collections: [parent] } as unknown as { collections: Dic[] };
  configureVersions(config as never);
  const access = config.collections.find((c) => c.slug === '$access_spec_news__versions')!.access;

  const staff = { id: 's1', isStaff: true } as any;
  const member = { id: 'u1' } as any;

  it('writes no row directly: a version is made and changed through its document', () => {
    expect(access.create(staff, {})).toBe(false);
    expect(access.update(staff, {})).toBe(false);
  });

  it('reads and deletes for staff the document allows, and for nobody else', () => {
    expect(access.read(staff, {})).toBe(true);
    expect(access.delete(staff, {})).toBe(true);
    expect(access.read(member, {})).toBe(false);
    expect(access.delete(member, {})).toBe(false);
  });
});
