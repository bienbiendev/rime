import type { DataType } from '$lib/core/fields/builders/form-field-builder.js';
import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import type { DefaultValueFn, FormField } from '$lib/fields/types.js';
import { sanitize } from '$lib/util/string.js';
import validate from '$lib/core/fields/validate.js';
import EmailComp from './component/Email.svelte';

export class EmailFieldBuilder extends FormFieldBuilder<EmailField> {
  constructor(name: string) {
    super(name, 'email');
    this.field.validate = validate.email;
    this.field.hooks = {
      beforeSave: [sanitize]
    };
  }

  get dataType(): DataType {
    return 'text';
  }

  get component() {
    return EmailComp;
  }

  layout(layout: 'compact' | 'default') {
    this.field.layout = layout;
    return this;
  }

  unique(bool?: boolean) {
    this.field.unique = typeof bool === 'boolean' ? bool : true;
    return this;
  }

  defaultValue(value: string | DefaultValueFn<string>) {
    this.field.defaultValue = value;
    return this;
  }

  isTitle() {
    this.field.isTitle = true;
    return this;
  }

  protected override generateType(): string {
    return `${this.name}${this.get.required ? '' : '?'}: string`;
  }
}

export const email = (name: string) => new EmailFieldBuilder(name);

/****************************************************/
/* Type
/****************************************************/
export type EmailField = FormField & {
  type: 'email';
  defaultValue?: string | DefaultValueFn<string>;
  placeholder?: string;
  layout?: 'compact' | 'default';
  unique?: boolean;
  isTitle?: true;
};
