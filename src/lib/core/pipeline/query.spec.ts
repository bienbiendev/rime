import { RimeError } from '#lib/core/errors/index.js';
import { date, email, group, relation, tab, tabs, text } from '#lib/fields/index.js';
import { describe, expect, it } from 'vitest';
import { assertReadableQuery, normalizeQuery, queryPaths } from './query.js';

const signedIn = (user: unknown) => !!user;
const staffOnly = (user: any) => !!user?.isStaff;

const pages = {
  slug: 'pages',
  fields: [
    text('title'),
    text('draftNote').access({ read: staffOnly }),
    group('seo').access({ read: staffOnly }).fields(text('score')),
    tabs(tab('attributes').fields(relation('author').to('staff'))),
    date('updatedAt')
  ],
  access: { read: () => true }
} as any;

/** `staff`, read by whoever `read` lets in; `email` by a signed-in user only. */
const staffWith = (read: (user: unknown) => boolean) =>
  ({
    slug: 'staff',
    fields: [text('name'), email('email').access({ read: signedIn })],
    access: { read }
  }) as any;

const eventFor = (user: unknown, staffRead: (user: unknown) => boolean = () => true) =>
  ({
    locals: {
      user,
      rime: {
        config: {
          getCollection: (slug: string) => ({ pages, staff: staffWith(staffRead) })[slug]
        }
      }
    }
  }) as any;

const where = (path: string) => ({ where: { [path]: { like: 'a%' } } });

const refused = expect.objectContaining({ code: RimeError.UNAUTHORIZED });
const notAField = expect.objectContaining({ code: RimeError.BAD_REQUEST });

describe('normalizeQuery', () => {
  it('keeps the operator of an and holding an or', () => {
    expect(normalizeQuery('where[and][0][or][0][title][equals]=a').where).toEqual({
      and: [{ or: [{ title: { equals: 'a' } }] }]
    });
  });

  it('keeps a list of 25 ids a list', () => {
    const query = Array.from({ length: 25 }, (_, i) => `where[id][in_array][${i}]=x${i}`).join('&');
    expect(Array.isArray(normalizeQuery(query).where.id.in_array)).toBe(true);
  });

  it('refuses a where that is not an object', () => {
    expect(() => normalizeQuery('where=foo')).toThrow(RimeError);
  });
});

describe('queryPaths', () => {
  it('names every path, through and and or', () => {
    expect(
      queryPaths({
        and: [{ title: { equals: 'a' } }, { or: [{ 'attributes.slug': { like: 'b%' } }] }]
      })
    ).toEqual(['title', 'attributes.slug']);
  });

  it('reads an and that qs parses into an object with numeric keys', () => {
    expect(
      queryPaths({ and: { 0: { title: { equals: 'a' } }, 21: { draftNote: { like: 'b%' } } } })
    ).toEqual(['title', 'draftNote']);
  });

  it('reads a query string as the adapter does', () => {
    const query = normalizeQuery(
      'where[and][0][title][equals]=a&where[and][1][or][0][draftNote][like]=b'
    );
    expect(queryPaths(query.where)).toEqual(['title', 'draftNote']);
  });
});

describe('assertReadableQuery', () => {
  const anonymous = eventFor(undefined);

  it('refuses a filter on a field the reader may not read', () => {
    expect(() =>
      assertReadableQuery({ config: pages, event: anonymous, query: where('draftNote') })
    ).toThrowError(refused);
  });

  it('refuses a filter under a group the reader may not read', () => {
    expect(() =>
      assertReadableQuery({ config: pages, event: anonymous, query: where('seo.score') })
    ).toThrowError(refused);
  });

  it('refuses a sort on a field the reader may not read, either way round', () => {
    expect(() =>
      assertReadableQuery({ config: pages, event: anonymous, sort: 'draftNote' })
    ).toThrowError(refused);
    expect(() =>
      assertReadableQuery({ config: pages, event: anonymous, sort: '-draftNote' })
    ).toThrowError(refused);
  });

  it('refuses a filter nested in an or', () => {
    const query = { where: { or: [{ title: { equals: 'a' } }, { draftNote: { like: 'a%' } }] } };
    expect(() => assertReadableQuery({ config: pages, event: anonymous, query })).toThrowError(
      refused
    );
  });

  it('lets a reader filter and sort on a field they may read', () => {
    const staff = eventFor({ isStaff: true });
    expect(() =>
      assertReadableQuery({ config: pages, event: anonymous, query: where('title'), sort: 'title' })
    ).not.toThrow();
    expect(() =>
      assertReadableQuery({ config: pages, event: staff, query: where('draftNote') })
    ).not.toThrow();
  });

  it('refuses a path into a related collection the reader may not read', () => {
    const event = eventFor({ id: 'u1' }, () => false);
    expect(() =>
      assertReadableQuery({ config: pages, event, query: where('attributes.author.email') })
    ).toThrowError(refused);
  });

  it('refuses a path to a field of the related collection the reader may not read', () => {
    expect(() =>
      assertReadableQuery({
        config: pages,
        event: anonymous,
        query: where('attributes.author.email')
      })
    ).toThrowError(refused);
  });

  it('lets a reader of the related collection and its field filter through the relation', () => {
    const event = eventFor({ id: 'u1' }, signedIn);
    expect(() =>
      assertReadableQuery({ config: pages, event, query: where('attributes.author.email') })
    ).not.toThrow();
  });

  it('refuses a column that is no field, and a path past a field that is no relation', () => {
    const admin = eventFor({ isStaff: true });
    expect(() =>
      assertReadableQuery({ config: pages, event: admin, query: where('authUserId') })
    ).toThrowError(notAField);
    expect(() =>
      assertReadableQuery({ config: pages, event: admin, query: where('title.foo') })
    ).toThrowError(notAField);
    expect(() =>
      assertReadableQuery({ config: pages, event: admin, sort: 'authUserId' })
    ).toThrowError(notAField);
  });

  it('lets anyone filter on a document key and sort by a readable date', () => {
    for (const path of ['id', 'ownerId', 'url']) {
      expect(() =>
        assertReadableQuery({ config: pages, event: anonymous, query: where(path) })
      ).not.toThrow();
    }
    expect(() =>
      assertReadableQuery({ config: pages, event: anonymous, sort: '-updatedAt' })
    ).not.toThrow();
  });
});
