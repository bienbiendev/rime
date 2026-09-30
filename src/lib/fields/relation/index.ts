import type { DataType } from '$lib/core/fields/builders/form-field-builder.js';
import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import type { CollectionSlug, GenericDoc } from '$lib/core/prototype/types.js';
import type { DefaultOptions, DefaultValueFn, FormField } from '$lib/fields/types.js';
import type { RegisterCollection } from '$lib/index.js';
import { capitalize } from '$lib/util/string.js';
import type { WithOptional } from '$lib/util/types.js';
import { ensureRelationExists } from '$rime/modules:fields/relation';
import dedent from 'dedent';
import Cell from './component/Cell.svelte';
import RelationComponent from './component/Relation.svelte';

export class RelationFieldBuilder<Doc extends GenericDoc = GenericDoc> extends FormFieldBuilder<
  RelationField<Doc>
> {
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

  to<Slug extends CollectionSlug>(slug: Slug): RelationFieldBuilder<RegisterCollection[Slug]> {
    this.field.relationTo = slug;
    return this as unknown as RelationFieldBuilder<RegisterCollection[Slug]>;
  }

  many() {
    this.field.many = true;
    return this;
  }

  defaultValue(
    value: string | string[] | DefaultValueFn<string | string[]>,
    options?: DefaultOptions
  ) {
    this.field.defaultValue = value;
    this.field.defaultFill = options?.fill;
    return this;
  }

  /** Documentation only — relation fields are diverted into relationFieldsMap/junction
   *  tables before reaching the adapter's generic column renderer (see root.server.ts). */
  get dataType(): DataType {
    return 'json';
  }

  protected override generateType(): string {
    const relationValueType = dedent`
    //@shared:start RelationValue
    export type RelationValue<T> =
      | T[] // When depth > 0, fully populated docs
      | { id?: string; relationTo: string; documentId: string }[] // When depth = 0, relation objects
      | string[]
      | string; // When sending data to update
    //@shared:end
    `;
    const fieldType = `${this.name}${this.get.required ? '' : '?'}: RelationValue<${capitalize(this.get.relationTo)}Doc>`;
    return [relationValueType, fieldType].join('\n');
  }
}

export const relation = (name: string) => new RelationFieldBuilder(name);

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

/**
 * A relation before it is written, when the row it hangs off does not exist yet.
 *
 * The only difference from `Relation` is that `ownerId` is not known — a create resolves it
 * after inserting the owner. Declared in the sqlite adapter until now, which meant core's
 * relation diffing imported a type from an adapter to describe its own intermediate value.
 */
export type BeforeOperationRelation = Omit<Relation, 'ownerId'> & { ownerId?: string };

type QueryResolver<Doc extends GenericDoc = GenericDoc> = (doc: WithOptional<Doc, 'id'>) => string;
