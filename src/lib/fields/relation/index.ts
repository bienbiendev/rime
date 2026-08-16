import type { DataType } from '$lib/core/fields/builders/form-field-builder.js';
import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import type { CollectionSlug, GenericDoc } from '$lib/core/types/doc.js';
import type {
  DefaultValueFn,
  Field,
  FormField,
  RelationRef,
  RelationValue
} from '$lib/fields/types.js';
import type { RegisterCollection } from '$lib/index.js';
import { hasProps, isObjectLiteral } from '$lib/util/object.js';
import type { WithOptional } from '$lib/util/types.js';
// @ts-expect-error — resolved at build time by the rime Vite plugin to either
// relation/runtime.server.ts (real check) or relation/runtime.ts (client no-op)
import { ensureRelationExists } from '$rime/runtime';
import Cell from './component/Cell.svelte';
import RelationComponent from './component/Relation.svelte';

export class RelationFieldBuilder<Doc extends GenericDoc = GenericDoc> extends FormFieldBuilder<
  RelationField<Doc>
> {
  //
  _metaUrl = import.meta.url;

  constructor(name: string) {
    super(name, 'relation');
    this.field.isEmpty = (value) => !value || (Array.isArray(value) && value.length === 0);
    this.field.defaultValue = [];
    this.field.hooks = {
      beforeValidate: [ensureRelationExists]
    };
  }

  get component() {
    return RelationComponent;
  }

  get cell() {
    return Cell;
  }

  isThumbnail(bool = true) {
    this.field.isThumbnail = bool;
    return this;
  }

  query(query: string | QueryResolver<Doc>) {
    (this.field as RelationField<Doc>).query = query;
    return this;
  }

  get __query(): string | QueryResolver<Doc> | undefined {
    return this.field.query;
  }

  to<Slug extends CollectionSlug>(slug: Slug): RelationFieldBuilder<RegisterCollection[Slug]> {
    this.field.relationTo = slug;
    return this as unknown as RelationFieldBuilder<RegisterCollection[Slug]>;
  }

  many() {
    this.field.many = true;
    return this;
  }

  get __many(): boolean {
    return !!this.field.many;
  }

  get __relationTo(): CollectionSlug {
    return this.field.relationTo;
  }

  defaultValue(value: string | string[] | DefaultValueFn<string | string[]>) {
    this.field.defaultValue = value;
    return this;
  }

  /** Documentation only — relation fields are diverted into relationFieldsMap/junction
   *  tables before reaching the adapter's generic column renderer (see root.server.ts). */
  get dataType(): DataType {
    return 'json';
  }
}

export const relation = (name: string) => new RelationFieldBuilder(name);

/**
 * Checks if a field is a relation field.
 */
export const isRelationField = (field: Field): field is RelationField => field.type === 'relation';

/**
 * Checks if a relation value is resolved (contains the actual referenced document).
 *
 * @example
 * // Returns true for a resolved relation
 * isRelationResolved({ title: 'Home Page', _prototype: 'collection', _type: 'pages' });
 */
export const isRelationResolved = <T>(value: any): value is T => {
  return value && isObjectLiteral(value) && hasProps(['title', '_prototype', '_type'], value);
};

/**
 * Checks if a relation value is a reference (contains only the relationTo and documentId).
 *
 * @example
 * // Returns true for a relation reference
 * isRelationRef({ relationTo: 'pages', documentId: '123' });
 */
export const isRelationRef = (value: unknown): value is RelationRef =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as any).relationTo === 'string' &&
  typeof (value as any).documentId === 'string';

/**
 * Checks if a relation value is unresolved (contains only reference information).
 *
 * @example
 * // Returns true for an unresolved relation
 * isRelationUnresolved({ relationTo: 'pages', documentId: '123' });
 */
export const isRelationUnresolved = (
  value: any
): value is Omit<Relation, 'path' | 'position' | 'ownerId'> => {
  return value && isObjectLiteral(value) && hasProps(['relationTo', 'documentId'], value);
};

/**
 * Resolves a relation reference to the actual document it points to.
 *
 * @example
 * // Resolves a relation reference to the actual document
 * const doc = await resolveRelationRef({ relationTo: 'pages', documentId: '123' });
 */
export async function resolveRelationRef<T>(item: T | RelationRef | string): Promise<T> {
  if (isRelationRef(item)) {
    return fetch(`api/${item.relationTo}/${item.documentId}`)
      .then((r) => r.json())
      .then((r) => r.doc);
  }
  if (typeof item === 'string') {
    throw new Error(
      `Cannot resolve relation from a bare id ("${item}") — missing "relationTo". ` +
        `resolveRelationRef only works on populated docs or { relationTo, documentId } objects.`
    );
  }
  if (isRelationResolved<T>(item)) {
    return item;
  }
  throw new Error(`Unrecognized relation shape: ${JSON.stringify(item)}`);
}

/**
 * Resolves a relation field value to the actual documents it points to.
 *
 * @example
 * // Resolves a relation value to the actual documents
 * const docs = await resolveRelation([{ relationTo: 'pages', documentId: '123' }]);
 */
export async function resolveRelation<T>(
  value: RelationValue<T> | null | undefined
): Promise<T[] | null | undefined> {
  if (value === null || value === undefined) return value;
  const items = Array.isArray(value) ? value : [value];
  return Promise.all(items.map((item) => resolveRelationRef<T>(item)));
}

/****************************************************/
/* Type
/****************************************************/

export type RelationField<Doc extends GenericDoc = GenericDoc> = FormField & {
  type: 'relation';
  relationTo: CollectionSlug;
  layout?: 'tags' | 'list';
  many?: boolean;
  defaultValue?: string | string[] | DefaultValueFn<string | string[]>;
  query?: string | ((doc: WithOptional<Doc, 'id'>) => string);
  isThumbnail?: boolean;
};

export type Relation = {
  id?: string;
  ownerId: string;
  path: string;
  position: number;
  relationTo: string;
  documentId: string;
  locale?: string;
  livePreview?: GenericDoc;
};

type QueryResolver<Doc extends GenericDoc = GenericDoc> = (doc: WithOptional<Doc, 'id'>) => string;
