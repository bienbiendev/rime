import { RimeFormError } from '#lib/core/errors/index.js';
import type { DataType } from '#lib/core/fields/builders/form-field-builder.js';
import { FormFieldBuilder } from '#lib/core/fields/builders/form-field-builder.js';
import type { DefaultValueFn, FieldValidationFunc, FormField } from '#lib/fields/types.js';
import NumberComponent from './component/Number.svelte';

export const number = (name: string) => new NumberFieldBuilder(name);

/** A number within the field's `min` and `max`, both included. */
const validateNumber: FieldValidationFunc<NumberField> = (value, { config }) => {
  if (typeof value !== 'number') {
    return RimeFormError.NOT_A_NUMBER;
  }
  if (config.min !== undefined && value < config.min) {
    return RimeFormError.NUMBER_TOO_SMALL;
  }
  if (config.max !== undefined && value > config.max) {
    return RimeFormError.NUMBER_TOO_LARGE;
  }
  return true;
};

export class NumberFieldBuilder extends FormFieldBuilder<NumberField> {
  constructor(name: string) {
    super(name, 'number');
    this.field.validate = validateNumber;
    this.field.isEmpty = (value) => typeof value !== 'number';
    // A form sends a number as text, and an emptied input as ''
    this.beforeValidate((value) => {
      if (value === '') return null;
      if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
        return Number(value);
      }
      return value;
    });
  }

  get component() {
    return NumberComponent;
  }

  min(value: number) {
    this.field.min = value;
    return this;
  }

  max(value: number) {
    this.field.max = value;
    return this;
  }

  get dataType(): DataType {
    return 'number';
  }

  protected override generateType(): string {
    return `${this.name}${this.get.required ? '' : '?'}: number`;
  }
}

/****************************************************/
/* Type
/****************************************************/

export type NumberField = FormField & {
  type: 'number';
  min?: number;
  max?: number;
  defaultValue?: number | DefaultValueFn<number>;
  validate?: FieldValidationFunc<NumberField>;
};
