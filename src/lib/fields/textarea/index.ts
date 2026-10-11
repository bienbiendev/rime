import type { DataType } from '#lib/core/fields/builders/form-field-builder.js';
import { FormFieldBuilder } from '#lib/core/fields/builders/form-field-builder.js';
import type { DefaultValueFn, FormField } from '#lib/fields/types.js';
import TextArea from './component/TextArea.svelte';

export const textarea = (name: string) => new TextAreaFieldBuilder(name);

const isString = (value: unknown) => typeof value === 'string' || 'Should be a string';

export class TextAreaFieldBuilder extends FormFieldBuilder<TextAreaField> {
  constructor(name: string) {
    super(name, 'textarea');
    this.field.validate = isString;
  }

  get component() {
    return TextArea;
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

  protected override generateType(): string {
    return `${this.name}${this.get.required ? '' : '?'}: string`;
  }
}

/****************************************************/
/* Type
/****************************************************/
export type TextAreaField = FormField & {
  type: 'textarea';
  defaultValue?: string | DefaultValueFn<string>;
  isTitle?: true;
  placeholder?: string;
};
