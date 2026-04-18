import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import type { DefaultValueFn, FormField } from '$lib/fields/types.js';
import { capitalize, sanitize } from '$lib/util/string.js';
import TextArea from './component/TextArea.svelte';

export const textarea = (name: string) => new TextAreaFieldBuilder(name);

export class TextAreaFieldBuilder extends FormFieldBuilder<TextAreaField> {
  //
  _metaUrl: string = import.meta.url;

  constructor(name: string) {
    super(name, 'textarea');
    this.field.hooks = {
      beforeSave: [sanitize]
    };
  }

  get component() {
    return TextArea;
  }

  get cell() {
    return null;
  }

  defaultValue(value: string | DefaultValueFn<string>) {
    this.field.defaultValue = value;
    return this;
  }

  isTitle() {
    this.field.isTitle = true;
    return this;
  }

  placeholder(str: string) {
    this.field.placeholder = str;
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
}

/****************************************************/
/* Type
/****************************************************/
export type TextAreaField = FormField & {
  type: 'textarea';
  defaultValue?: string | DefaultValueFn<string>;
  isTitle?: true;
  placeholder: string;
};
