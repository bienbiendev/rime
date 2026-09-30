import type {
  DefaultOptions,
  DefaultValueFn,
  FieldValidationFunc,
  FormField
} from '$lib/fields/types.js';
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
  }

  defaultValue(value: boolean | DefaultValueFn<boolean>, options?: DefaultOptions) {
    this.field.defaultValue = value;
    this.field.defaultFill = options?.fill;
    return this;
  }

  get dataType(): 'boolean' {
    return 'boolean';
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
