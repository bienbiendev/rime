import { HOOK_MARKS } from '$lib/core/pipeline/marks.js';
import { describe, expect, it } from 'vitest';
import { resolvePipeline } from './resolve-pipeline.server.js';
import type { HookMark } from './types.js';

const hook = (name: string, requires: HookMark[] = [], provides: HookMark[] = []) => ({
  name,
  requires,
  provides
});

const names = (hooks: { name: string }[]) => hooks.map((h) => h.name);

const resolve = (hooks: { name: string; requires: HookMark[]; provides: HookMark[] }[]) =>
  names(resolvePipeline({ hooks, label: 'test' }));

describe('resolvePipeline', () => {
  it('keeps input order when nothing constrains anything', () => {
    expect(resolve([hook('a'), hook('b'), hook('c')])).toEqual(['a', 'b', 'c']);
  });

  it('moves a hook after the mark it requires, however it was ordered on input', () => {
    const shape = hook('shape', [], [HOOK_MARKS.SHAPED]);
    const title = hook(HOOK_MARKS.TITLE, [HOOK_MARKS.SHAPED], [HOOK_MARKS.TITLE]);
    expect(resolve([title, shape])).toEqual(['shape', HOOK_MARKS.TITLE]);
  });

  it('waits for EVERY provider of a mark, not just the first', () => {
    // The property sortDocumentProps depends on: it must follow every hook that writes to the
    // document, including ones from features it cannot name.
    const sort = hook('sort', [HOOK_MARKS.DOCUMENT]);
    const core = hook('core', [], [HOOK_MARKS.DOCUMENT]);
    const feature = hook('feature', [], [HOOK_MARKS.DOCUMENT]);
    expect(resolve([sort, core, feature])).toEqual(['core', 'feature', 'sort']);
  });

  it('satisfies a requirement vacuously when nothing active provides it', () => {
    // removePrivateFields only exists when a collection has auth; a hook requiring HOOK_MARKS.SANITIZED
    // must still run on collections that have none.
    expect(resolve([hook('shape', [HOOK_MARKS.SANITIZED], [HOOK_MARKS.SHAPED])])).toEqual([
      'shape'
    ]);
  });

  it('lets one declaration be correct at two timings', () => {
    // augmentFieldsPassword requires HOOK_MARKS.BLANK_MERGED: it waits in beforeCreate, where the merge
    // provides it, and runs free in beforeUpdate, where nothing does.
    const augment = hook(
      'augmentFieldsPassword',
      [HOOK_MARKS.BLANK_MERGED],
      [HOOK_MARKS.CONFIG_FIELDS]
    );
    const merge = hook('mergeWithBlankDocument', [], [HOOK_MARKS.BLANK_MERGED]);
    const buildMap = hook(
      'buildDataConfigMap',
      [HOOK_MARKS.CONFIG_FIELDS],
      [HOOK_MARKS.CONFIG_MAP]
    );

    expect(resolve([merge, augment, buildMap])).toEqual([
      'mergeWithBlankDocument',
      'augmentFieldsPassword',
      'buildDataConfigMap'
    ]);
    expect(resolve([augment, buildMap])).toEqual(['augmentFieldsPassword', 'buildDataConfigMap']);
  });

  it('does not treat a hook that both provides and requires a mark as a cycle', () => {
    // Every document writer provides HOOK_MARKS.DOCUMENT; some also require it.
    const a = hook('a', [HOOK_MARKS.DOCUMENT], [HOOK_MARKS.DOCUMENT]);
    const b = hook('b', [], [HOOK_MARKS.DOCUMENT]);
    expect(resolve([a, b])).toEqual(['b', 'a']);
  });

  it('throws naming the hooks when no order satisfies them', () => {
    const a = hook('a', [HOOK_MARKS.TITLE], [HOOK_MARKS.SHAPED]);
    const b = hook('b', [HOOK_MARKS.SHAPED], [HOOK_MARKS.TITLE]);
    expect(() => resolve([a, b])).toThrowError(/no order satisfies these hooks/);
    expect(() => resolve([a, b])).toThrowError(/a waits on b/);
  });

  it('breaks ties by input position, so the result is reproducible', () => {
    const shape = hook('shape', [], [HOOK_MARKS.SHAPED]);
    const one = hook('one', [HOOK_MARKS.SHAPED]);
    const two = hook('two', [HOOK_MARKS.SHAPED]);
    const three = hook('three', [HOOK_MARKS.SHAPED]);
    expect(resolve([shape, one, two, three])).toEqual(['shape', 'one', 'two', 'three']);
    expect(resolve([shape, three, two, one])).toEqual(['shape', 'three', 'two', 'one']);
  });
});
