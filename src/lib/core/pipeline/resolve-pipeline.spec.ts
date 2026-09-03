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
    const shape = hook('shape', [], ['shaped']);
    const title = hook('title', ['shaped'], ['title']);
    expect(resolve([title, shape])).toEqual(['shape', 'title']);
  });

  it('waits for EVERY provider of a mark, not just the first', () => {
    // The property sortDocumentProps depends on: it must follow every hook that writes to the
    // document, including ones from features it cannot name.
    const sort = hook('sort', ['document']);
    const core = hook('core', [], ['document']);
    const feature = hook('feature', [], ['document']);
    expect(resolve([sort, core, feature])).toEqual(['core', 'feature', 'sort']);
  });

  it('satisfies a requirement vacuously when nothing active provides it', () => {
    // removePrivateFields only exists when a collection has auth; a hook requiring 'sanitized'
    // must still run on collections that have none.
    expect(resolve([hook('shape', ['sanitized'], ['shaped'])])).toEqual(['shape']);
  });

  it('lets one declaration be correct at two timings', () => {
    // augmentFieldsPassword requires 'blank-merged': it waits in beforeCreate, where the merge
    // provides it, and runs free in beforeUpdate, where nothing does.
    const augment = hook('augmentFieldsPassword', ['blank-merged'], ['config-fields']);
    const merge = hook('mergeWithBlankDocument', [], ['blank-merged']);
    const buildMap = hook('buildDataConfigMap', ['config-fields'], ['config-map']);

    expect(resolve([merge, augment, buildMap])).toEqual([
      'mergeWithBlankDocument',
      'augmentFieldsPassword',
      'buildDataConfigMap'
    ]);
    expect(resolve([augment, buildMap])).toEqual(['augmentFieldsPassword', 'buildDataConfigMap']);
  });

  it('does not treat a hook that both provides and requires a mark as a cycle', () => {
    // Every document writer provides 'document'; some also require it.
    const a = hook('a', ['document'], ['document']);
    const b = hook('b', [], ['document']);
    expect(resolve([a, b])).toEqual(['b', 'a']);
  });

  it('throws naming the hooks when no order satisfies them', () => {
    const a = hook('a', ['title'], ['shaped']);
    const b = hook('b', ['shaped'], ['title']);
    expect(() => resolve([a, b])).toThrowError(/no order satisfies these hooks/);
    expect(() => resolve([a, b])).toThrowError(/a waits on b/);
  });

  it('breaks ties by input position, so the result is reproducible', () => {
    const shape = hook('shape', [], ['shaped']);
    const one = hook('one', ['shaped']);
    const two = hook('two', ['shaped']);
    const three = hook('three', ['shaped']);
    expect(resolve([shape, one, two, three])).toEqual(['shape', 'one', 'two', 'three']);
    expect(resolve([shape, three, two, one])).toEqual(['shape', 'three', 'two', 'one']);
  });
});
