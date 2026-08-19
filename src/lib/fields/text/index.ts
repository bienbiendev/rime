import type { DataType } from '$lib/core/fields/builders/form-field-builder.js';
import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import type { DefaultValueFn, FormField } from '$lib/fields/types.js';
import { capitalize, sanitize } from '$lib/util/string.js';
import Text from './component/Text.svelte';

/****************************************************/
export class TextFieldBuilder extends FormFieldBuilder<TextField> {
  constructor(name: string) {
    super(name, 'text');
    this.field.hooks = {
      beforeSave: [sanitize]
    };
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

  defaultValue(value: string | DefaultValueFn<string>) {
    this.field.defaultValue = value;
    return this;
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

  compile() {
    if (!this.field.validate) {
      this.field.validate = (value: any) => {
        return typeof value === 'string' || 'Should be a string';
      };
    }

    if (!this.field.placeholder) {
      this.field.placeholder = this.field.label || capitalize(this.field.name);
    }

    return super.compile();
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
  placeholder: string;
  layout?: 'compact';
} & FormField;
