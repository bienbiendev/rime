import { text } from '$lib/fields/text/index.js';
import { describe, expect, it } from 'vitest';
import { collection, create } from '$lib/core/prototype/collection/definition.js';
import { writePlanWithFeatures } from '../registry.js';
import { VERSIONS_OPERATIONS } from './strategy.js';

/**
 * Which rows an update writes.
 *
 * This was three branches inside `updatePrototype`, decoded from a `versionOperation` the
 * operation passed down. Getting it wrong is **silent**: a plan that names no content row writes
 * only the base row and returns 200, and a plan that names the wrong one writes the wrong version
 * — no error either way, and the document reads back through a different query.
 *
 * So the three cases are asserted through the same fold `runUpdate` uses, on a real built config.
 */
const planFor = (
  config: Parameters<typeof writePlanWithFeatures>[2]['config'],
  data: object,
  context: object
) => writePlanWithFeatures(collection.features, { data: { ...data } }, { config, context });

describe('the write plan', () => {
  const versioned = create('spec_plan_news', {
    versions: { draft: true },
    fields: [text('title').isTitle(), text('body')]
  });

  it('puts everything on the base row when no feature gives the config a second one', () => {
    const plain = create('spec_plan_pages', { fields: [text('title').isTitle()] });

    const plan = planFor(plain, { title: 'a' }, { versionOperation: VERSIONS_OPERATIONS.UPDATE });

    expect(plan).toEqual({ data: { title: 'a' } });
  });

  it('splits and names the row when the update writes a specific version', () => {
    const plan = planFor(
      versioned,
      { title: 'a', body: 'b' },
      { versionOperation: VERSIONS_OPERATIONS.UPDATE_VERSION, contentOwnerId: 'v1' }
    );

    // `_parent`/`_position`/`_path` are the `._root()` fields; this config marks none, so the
    // base half is empty and everything is content. The point is the shape, and the row named.
    expect(plan.content).toEqual({ id: 'v1', data: { title: 'a', body: 'b' } });
  });

  it('keeps a ._root() field on the base row', () => {
    const nested = create('spec_plan_nested', {
      versions: true,
      nested: true,
      fields: [text('title').isTitle()]
    });

    const plan = planFor(
      nested,
      { title: 'a', _parent: 'p1' },
      { versionOperation: VERSIONS_OPERATIONS.UPDATE_VERSION, contentOwnerId: 'v1' }
    );

    // The site tree would fork per revision if `_parent` went to the version row.
    expect(plan.data).toEqual({ _parent: 'p1' });
    expect(plan.content).toEqual({ id: 'v1', data: { title: 'a' } });
  });

  it('names no row when the version was already written by handleNewVersion', () => {
    const plan = planFor(
      versioned,
      { title: 'a' },
      { versionOperation: VERSIONS_OPERATIONS.NEW_DRAFT_FROM_PUBLISHED, contentOwnerId: 'v2' }
    );

    // `contentOwnerId` is set — blocks and relations still hang off that row — and the plan still
    // names no content row, because this write is not the one that made it.
    expect(plan.content).toBeUndefined();
  });

  it('does not empty the data it was handed', () => {
    const data = { title: 'a', body: 'b' };

    writePlanWithFeatures(
      collection.features,
      { data },
      {
        config: versioned,
        context: { versionOperation: VERSIONS_OPERATIONS.UPDATE_VERSION, contentOwnerId: 'v1' }
      }
    );

    // `extractRootData` used to delete the base keys out of the caller's own object, which
    // `runUpdate` then handed to `persistRelational`.
    expect(data).toEqual({ title: 'a', body: 'b' });
  });
});
