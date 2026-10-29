import type { DataType } from '#lib/core/fields/builders/form-field-builder.js';
import { FormFieldBuilder } from '#lib/core/fields/builders/form-field-builder.js';
import type { DefaultValueFn, FormField } from '#lib/fields/types.js';
import * as validate from '#lib/core/fields/validate.js';
import { duplicateSlug } from '$rime/modules:fields/slug';
import Cell from './component/Cell.svelte';
import Slug from './component/Slug.svelte';

/** A url-safe name — lowercase letters, digits and dashes — stored as text. */
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

  /**
   * Fills the slug from another field while the document has no slug of its own. `fieldName` is
   * that field's path: `title`, or `attributes.title` inside a tab or group.
   */
  slugify(fieldName: string) {
    this.field.slugify = fieldName;
    return this;
  }

  /** `compact` hides the label: the placeholder names the field. */
  layout(layout: 'compact' | 'default') {
    this.field.layout = layout;
    return this;
  }

  /**
   * No other document of the collection may hold the same slug. A duplicate takes the first free
   * copy: `sale-copy`, then `sale-copy-2`.
   */
  unique(bool?: boolean) {
    this.field.unique = typeof bool === 'boolean' ? bool : true;
    return this;
  }

  get dataType(): DataType {
    return 'text';
  }

  /** The document's title in the panel and its lists; a duplicate gets `-copy`. */
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
