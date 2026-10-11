import { group, text } from '#lib/fields/index.js';
import { describe, expect, it, vi } from 'vitest';
import { seenBy } from './seen-by.server.js';

const staffOnly = { read: (user: any) => !!user?.isStaff };
const fields = [
  text('name'),
  text('note').access(staffOnly),
  group('meta').fields(text('a'), text('b').access(staffOnly))
];
const doc = { id: 'c1', name: 'Ann', note: 'vip', meta: { a: 'A', b: 'B' } } as any;

const configWith = (read: (user: any, options: any) => boolean) =>
  ({ slug: 'contacts', fields, access: { read: vi.fn(read) } }) as any;

describe('seenBy', () => {
  it('answers the id alone when the read is refused', () => {
    const event = { locals: { user: undefined } } as any;
    expect(seenBy({ event, config: configWith(() => false), doc: structuredClone(doc) })).toEqual({
      id: 'c1'
    });
  });

  it('answers the document without the fields the user may not read, at any depth', () => {
    const event = { locals: { user: undefined } } as any;
    expect(seenBy({ event, config: configWith(() => true), doc: structuredClone(doc) })).toEqual({
      id: 'c1',
      name: 'Ann',
      meta: { a: 'A' }
    });
  });

  it('answers the whole document to a user who may read every field', () => {
    const event = { locals: { user: { isStaff: true } } } as any;
    expect(seenBy({ event, config: configWith(() => true), doc: structuredClone(doc) })).toEqual(
      doc
    );
  });

  it('asks the read access with the event and the id, as a read does', () => {
    const user = { id: 'u' };
    const event = { locals: { user } } as any;
    const config = configWith(() => true);
    seenBy({ event, config, doc: structuredClone(doc) });
    expect(config.access.read).toHaveBeenCalledWith(user, { event, id: 'c1' });
  });
});
