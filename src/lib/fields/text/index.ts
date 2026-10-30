import type { DataType } from '#lib/core/fields/builders/form-field-builder.js';
import { FormFieldBuilder } from '#lib/core/fields/builders/form-field-builder.js';
import type { DefaultValueFn, FormField } from '#lib/fields/types.js';
import validate from '#lib/core/fields/validate.js';
import { duplicateText } from '$rime/modules:fields/text';
import Text from './component/Text.svelte';

/****************************************************/
export class TextFieldBuilder extends FormFieldBuilder<TextField> {
  constructor(name: string) {
    super(name, 'text');
    this.field.validate = validate.string;
    this.$beforeDuplicate(duplicateText);
  }

  /**
   * No other document of the collection may hold the same value. A duplicate takes the first free
   * copy: `Sale (copy)`, then `Sale (copy 2)`.
   */
  unique(bool?: boolean) {
    this.field.unique = typeof bool === 'boolean' ? bool : true;
    return this;
  }

  get component() {
    return Text;
  }

  get cell() {
    return null;
  }

  get dataType(): DataType {
    return 'text';
  }

  /** The document's title in the panel and its lists; a duplicate gets ` (copy)`. */
  isTitle() {
    this.field.isTitle = true;
    return this;
  }

  placeholder(str: string) {
    this.field.placeholder = str;
    return this;
  }

  /** `compact` hides the label: the placeholder names the field. */
  layout(layout: 'compact') {
    this.field.layout = layout;
    return this;
  }

  protected override generateType(): string {
    return `${this.name}${this.get.required ? '' : '?'}: string`;
  }
}

/** A one-line text, stored as text. */
export const text = (name: string) => new TextFieldBuilder(name);

/****************************************************/
/* Type
/****************************************************/
export type TextField = {
  type: 'text';
  defaultValue?: string | DefaultValueFn<string>;
  unique?: boolean;
  isTitle?: true;
  placeholder?: string;
  layout?: 'compact';
} & FormField;
