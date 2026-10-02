import { describe, expect, it, vi } from 'vitest';
import { missingRelations, relationIds } from './exists.server.js';

describe('relationIds', () => {
  it('reads bare ids, refs and documents read at depth 1', () => {
    expect(
      relationIds(['a', { relationTo: 'medias', documentId: 'b' }, { id: 'c', title: 'C' }])
    ).toEqual(['a', 'b', 'c']);
  });

  it('reads one value outside an array as a list of one', () => {
    expect(relationIds('a')).toEqual(['a']);
    expect(relationIds({ relationTo: 'medias', documentId: 'b' })).toEqual(['b']);
  });

  it('skips what names nothing', () => {
    expect(relationIds([null, '', { title: 'no id' }, 'a'])).toEqual(['a']);
    expect(relationIds(undefined)).toEqual([]);
  });
});

describe('missingRelations', () => {
  const adapterWith = (missing: string[]) =>
    ({ relations: { missing: vi.fn(async () => missing) } }) as any;

  it('asks the database once, with every id the value names', async () => {
    const adapter = adapterWith(['b']);
    expect(await missingRelations(adapter, 'medias' as never, ['a', 'b'])).toEqual(['b']);
    expect(adapter.relations.missing).toHaveBeenCalledTimes(1);
    expect(adapter.relations.missing).toHaveBeenCalledWith({
      relationTo: 'medias',
      ids: ['a', 'b']
    });
  });

  it('asks nothing for a value that names nothing', async () => {
    const adapter = adapterWith([]);
    expect(await missingRelations(adapter, 'medias' as never, [])).toEqual([]);
    expect(adapter.relations.missing).not.toHaveBeenCalled();
  });
});
