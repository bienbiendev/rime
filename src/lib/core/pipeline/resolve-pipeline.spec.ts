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
    const shape = hook('shape', [], ['__shaped']);
    const title = hook('__title', ['__shaped'], ['__title']);
    expect(resolve([title, shape])).toEqual(['shape', '__title']);
  });

  it('waits for EVERY provider of a mark, not just the first', () => {
    // The property sortDocumentProps depends on: it must follow every hook that writes to the
    // document, including ones from features it cannot name.
    const sort = hook('sort', ['__document']);
    const core = hook('core', [], ['__document']);
    const feature = hook('feature', [], ['__document']);
    expect(resolve([sort, core, feature])).toEqual(['core', 'feature', 'sort']);
  });

  it('satisfies a requirement vacuously when nothing active provides it', () => {
    // removePrivateFields only exists when a collection has auth; a hook requiring '__sanitized'
    // must still run on collections that have none.
    expect(resolve([hook('shape', ['__sanitized'], ['__shaped'])])).toEqual(['shape']);
  });

  it('lets one declaration be correct at two timings', () => {
    // augmentFieldsPassword requires '__blank-merged': it waits in beforeCreate, where the merge
    // provides it, and runs free in beforeUpdate, where nothing does.
    const augment = hook('augmentFieldsPassword', ['__blank-merged'], ['__config-fields']);
    const merge = hook('mergeWithBlankDocument', [], ['__blank-merged']);
    const buildMap = hook('buildDataConfigMap', ['__config-fields'], ['__config-map']);

    expect(resolve([merge, augment, buildMap])).toEqual([
      'mergeWithBlankDocument',
      'augmentFieldsPassword',
      'buildDataConfigMap'
    ]);
    expect(resolve([augment, buildMap])).toEqual(['augmentFieldsPassword', 'buildDataConfigMap']);
  });

  it('does not treat a hook that both provides and requires a mark as a cycle', () => {
    // Every document writer provides '__document'; some also require it.
    const a = hook('a', ['__document'], ['__document']);
    const b = hook('b', [], ['__document']);
    expect(resolve([a, b])).toEqual(['b', 'a']);
  });

  it('throws naming the hooks when no order satisfies them', () => {
    const a = hook('a', ['__title'], ['__shaped']);
    const b = hook('b', ['__shaped'], ['__title']);
    expect(() => resolve([a, b])).toThrowError(/no order satisfies these hooks/);
    expect(() => resolve([a, b])).toThrowError(/a waits on b/);
  });

  it('breaks ties by input position, so the result is reproducible', () => {
    const shape = hook('shape', [], ['__shaped']);
    const one = hook('one', ['__shaped']);
    const two = hook('two', ['__shaped']);
    const three = hook('three', ['__shaped']);
    expect(resolve([shape, one, two, three])).toEqual(['shape', 'one', 'two', 'three']);
    expect(resolve([shape, three, two, one])).toEqual(['shape', 'three', 'two', 'one']);
  });
});
