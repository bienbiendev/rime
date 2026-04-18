import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import type { DefaultValueFn, FieldValidationFunc, FormField } from '$lib/fields/types.js';
import Number from './component/Number.svelte';

export const number = (name: string) => new NumberFieldBuilder(name);

const validateNumber: FieldValidationFunc<NumberField> = (value, { config }) => {
  if (typeof value !== 'number') {
    return 'Should be a number';
  }
  if (config.min && value < config.min) {
    return 'Should be greater than ' + config.min;
  }
  if (config.max && value > config.max) {
    return 'Should be lower than ' + config.max;
  }
  return true;
};

export class NumberFieldBuilder extends FormFieldBuilder<NumberField> {
  //
  _metaUrl = import.meta.url;

  constructor(name: string) {
    super(name, 'number');
    this.field.validate = validateNumber;
    this.field.isEmpty = (value) => typeof value !== 'number';
  }

  get component() {
    return Number;
  }

  defaultValue(value: number | DefaultValueFn<number>) {
    this.field.defaultValue = value;
    return this;
  }

  min(value: number) {
    this.field.min = value;
    return this;
  }

  max(value: number) {
    this.field.max = value;
    return this;
  }

  compile() {
    if (!this.field.defaultValue) {
      this.field.defaultValue = this.field.min || 0;
    }
    return super.compile();
  }

  _root() {
    this.field._root = true;
    return this;
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
  /**
   * Force the field to be on the root table
   * usefull for fields that should not be versioned
   * ex: _parent for nested structures should always be on the root table to prevent
   * different versions to have different parents
   */
  _root?: boolean;
};
