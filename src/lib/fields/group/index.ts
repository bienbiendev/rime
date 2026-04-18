import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import type { Field, FormField } from '$lib/fields/types.js';
import Group from './component/Group.svelte';

const isEmpty = (value: unknown) =>
  !!value === false ||
  (typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value).length === 0);

export class GroupFieldBuilder extends FormFieldBuilder<GroupField> {
  //
  _metaUrl = import.meta.url;

  constructor(name: string) {
    super(name, 'group');
    this.field.isEmpty = isEmpty;
  }

  get component() {
    return Group;
  }

  label(label: string) {
    this.field.label = label;
    return this;
  }

  fields(...fields: FieldBuilder<Field>[]) {
    this.field.fields = fields;
    return this;
  }

  localized() {
    this.field.localized = true;
    this.field.fields = this.field.fields.map((field) => {
      if (field instanceof FormFieldBuilder) {
        return field.clone().localized();
      }
      return field;
    });
    return this;
  }

  compile() {
    return { ...this.field, fields: this.field.fields.map((f) => f.compile()) };
  }
}

export const group = (name: string) => new GroupFieldBuilder(name);

/**
 * Checks if a field is a group field.
 */
export const isGroupField = (field: Field): field is GroupField => field.type === 'group';

/**
 * Checks if a field is a group field (raw type).
 */
export const isGroupFieldRaw = (field: Field): field is GroupFieldRaw => field.type === 'group';

/****************************************************/
/* Types
/****************************************************/

export type GroupField = FormField & {
  type: 'group';
  name: string;
  label?: string;
  fields: FieldBuilder<Field>[];
};

export type GroupFieldRaw = FormField & {
  type: 'group';
  name: string;
  label?: string;
  fields: Field[];
};
