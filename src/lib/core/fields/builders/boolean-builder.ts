import type { DefaultValueFn, FieldValidationFunc, FormField } from '$lib/fields/types.js';
import { FormFieldBuilder } from './form-field-builder.js';

type BooleanField = FormField & {
  type: any;
  name: any;
  defaultValue?: boolean | DefaultValueFn<boolean>;
  validate?: FieldValidationFunc<BooleanField>;
};

export class BooleanFieldBuilder<T extends BooleanField> extends FormFieldBuilder<T> {
  constructor(name: string, type: string) {
    super(name, type);
    this.field.defaultValue = false;
  }

  defaultValue(value: boolean | DefaultValueFn<boolean>) {
    this.field.defaultValue = value;
    return this;
  }

  compile() {
    if (!this.field.validate) {
      this.field.validate = (value: unknown) =>
        typeof value === 'boolean' || 'Should be true/false';
    }
    if (!this.field.defaultValue) {
      this.field.defaultValue = false;
    }
    return super.compile();
  }
}
