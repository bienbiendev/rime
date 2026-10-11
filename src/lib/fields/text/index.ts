import type { DataType } from '#lib/core/fields/builders/form-field-builder.js';
import { FormFieldBuilder } from '#lib/core/fields/builders/form-field-builder.js';
import type { DefaultValueFn, FormField } from '#lib/fields/types.js';
import { duplicateText } from '$rime/modules:fields/text';
import Text from './component/Text.svelte';

const isString = (value: unknown) => typeof value === 'string' || 'Should be a string';

/****************************************************/
export class TextFieldBuilder extends FormFieldBuilder<TextField> {
  constructor(name: string) {
    super(name, 'text');
    this.field.validate = isString;
    this.$beforeDuplicate(duplicateText);
  }

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

  isTitle() {
    this.field.isTitle = true;
    return this;
  }

  placeholder(str: string) {
    this.field.placeholder = str;
    return this;
  }

  layout(layout: 'compact') {
    this.field.layout = layout;
    return this;
  }

  protected override generateType(): string {
    return `${this.name}${this.get.required ? '' : '?'}: string`;
  }
}

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
