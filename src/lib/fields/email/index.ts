import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import type { DefaultValueFn, FormField } from '$lib/fields/types.js';
import { sanitize } from '$lib/util/string';
import validate from '$lib/util/validate.js';
import EmailComp from './component/Email.svelte';

class EmailFieldBuilder extends FormFieldBuilder<EmailField> {
  //
  _metaUrl: string = import.meta.url;

  constructor(name: string) {
    super(name, 'email');
    this.field.validate = validate.email;
    this.field.hooks = {
      beforeSave: [sanitize]
    };
  }

  layout(layout: 'compact' | 'default') {
    this.field.layout = layout;
    return this;
  }

  get component() {
    return EmailComp;
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
