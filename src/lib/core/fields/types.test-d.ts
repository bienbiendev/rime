import type { RelationInput, RelationRef, RelationValue } from '$lib/fields/types.js';
import { describe, expectTypeOf, it } from 'vitest';
import type { WithRelationInput, WithRelationResolved } from './types.js';

type MediasDoc = { id: string; _type: 'medias'; alt?: string };
type UsersDoc = { id: string; _type: 'users'; name?: string; avatar?: RelationValue<MediasDoc> };
type BlockImage = { id: string; type: 'image'; image?: RelationValue<MediasDoc> };
type PagesDoc = {
  id: string;
  title: string;
  createdAt?: Date;
  tags?: string[];
  hero: { thumbnail?: RelationValue<MediasDoc> };
  author?: RelationValue<UsersDoc>;
  sections: Array<BlockImage>;
};

describe('WithRelationResolved', () => {
  it('resolves the relations at depth 1, and reads the related documents at depth 0', () => {
    type Page = WithRelationResolved<PagesDoc, 1>;
    expectTypeOf<Page['hero']['thumbnail']>().toEqualTypeOf<MediasDoc[] | undefined>();
    expectTypeOf<NonNullable<Page['author']>>().toEqualTypeOf<UsersDoc[]>();
    expectTypeOf<NonNullable<Page['author']>[number]['avatar']>().toEqualTypeOf<
      RelationValue<MediasDoc> | undefined
    >();
  });

  it('walks blocks at the same depth', () => {
    type Page = WithRelationResolved<PagesDoc, 1>;
    expectTypeOf<Page['sections'][number]['image']>().toEqualTypeOf<MediasDoc[] | undefined>();
    expectTypeOf<Page['sections'][number]['type']>().toEqualTypeOf<'image'>();
  });

  it('resolves the related documents too at depth 2', () => {
    type Page = WithRelationResolved<PagesDoc, 2>;
    expectTypeOf<NonNullable<Page['author']>[number]['avatar']>().toEqualTypeOf<
      MediasDoc[] | undefined
    >();
  });

  it('keeps the other fields as they are', () => {
    type Page = WithRelationResolved<PagesDoc, 1>;
    expectTypeOf<Page['title']>().toEqualTypeOf<string>();
    expectTypeOf<Page['createdAt']>().toEqualTypeOf<Date | undefined>();
    expectTypeOf<Page['tags']>().toEqualTypeOf<string[] | undefined>();
  });

  it('is the document as typed at depth 0, and at a depth it cannot know', () => {
    expectTypeOf<WithRelationResolved<PagesDoc, 0>>().toEqualTypeOf<PagesDoc>();
    expectTypeOf<WithRelationResolved<PagesDoc, number>>().toEqualTypeOf<PagesDoc>();
  });
});

describe('WithRelationInput', () => {
  it('lets a relation take bare ids, in a block too', () => {
    type Input = WithRelationInput<PagesDoc>;
    expectTypeOf<Input['author']>().toEqualTypeOf<RelationInput<UsersDoc> | undefined>();
    expectTypeOf<Input['sections'][number]['image']>().toEqualTypeOf<
      RelationInput<MediasDoc> | undefined
    >();
    expectTypeOf<'u1'>().toExtend<NonNullable<Input['author']>>();
    expectTypeOf<RelationRef[]>().toExtend<NonNullable<Input['author']>>();
  });

  it('keeps the other fields as they are', () => {
    type Input = WithRelationInput<PagesDoc>;
    expectTypeOf<Input['title']>().toEqualTypeOf<string>();
    expectTypeOf<Input['tags']>().toEqualTypeOf<string[] | undefined>();
    expectTypeOf<Input['createdAt']>().toEqualTypeOf<Date | undefined>();
  });
});
