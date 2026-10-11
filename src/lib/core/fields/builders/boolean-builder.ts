import type { DefaultValueFn, FieldValidationFunc, FormField } from '#lib/fields/types.js';
import { FormFieldBuilder } from './form-field-builder.js';

type BooleanField = FormField & {
  type: any;
  name: any;
  defaultValue?: boolean | DefaultValueFn<boolean>;
  validate?: FieldValidationFunc<BooleanField>;
};

export class BooleanFieldBuilder<
  T extends BooleanField = BooleanField
> extends FormFieldBuilder<T> {
  constructor(name: string, type: string) {
    super(name, type);
    this.field.defaultValue = false;
    // `false` is a value: only a missing one is empty.
    this.field.isEmpty = (value) => typeof value !== 'boolean';
    this.field.validate = (value: unknown) => typeof value === 'boolean' || 'Should be true/false';
    // A form sends a checked box as 'true' or 'on', and 'false' for an explicit no
    this.beforeValidate((value) =>
      value === 'true' || value === 'on' ? true : value === 'false' ? false : value
    );
  }

  get dataType(): 'boolean' {
    return 'boolean';
  }
}
