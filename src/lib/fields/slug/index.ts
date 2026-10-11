import type { DataType } from '#lib/core/fields/builders/form-field-builder.js';
import { FormFieldBuilder } from '#lib/core/fields/builders/form-field-builder.js';
import type { DefaultValueFn, FormField } from '#lib/fields/types.js';
import * as validate from '#lib/core/fields/validate.js';
import { duplicateSlug } from '$rime/modules:fields/slug';
import Cell from './component/Cell.svelte';
import Slug from './component/Slug.svelte';

export const slug = (name: string) => new SlugFieldBuilder(name);

export class SlugFieldBuilder extends FormFieldBuilder<SlugField> {
  constructor(name: string) {
    super(name, 'slug');
    this.field.validate = validate.slug;
    this.field.isEmpty = (value) => !value;
    this.$beforeDuplicate(duplicateSlug);
  }

  get component() {
    return Slug;
  }

  get cell() {
    return Cell;
  }

  placeholder(placeholder: string) {
    this.field.placeholder = placeholder;
    return this;
  }

  slugify(fieldName: string) {
    this.field.slugify = fieldName;
    return this;
  }

  layout(layout: 'compact' | 'default') {
    this.field.layout = layout;
    return this;
  }

  unique(bool?: boolean) {
    this.field.unique = typeof bool === 'boolean' ? bool : true;
    return this;
  }

  get dataType(): DataType {
    return 'text';
  }

  isTitle() {
    this.field.isTitle = true;
    return this;
  }

  protected override generateType(): string {
    return `${this.name}${this.get.required ? '' : '?'}: string`;
  }
}

/****************************************************/
/* Type
/****************************************************/
export type SlugField = FormField & {
  type: 'slug';
  slugify?: string;
  defaultValue?: string | DefaultValueFn<string>;
  unique?: boolean;
  isTitle?: true;
  placeholder?: string;
  layout?: 'compact' | 'default';
};
