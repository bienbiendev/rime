import { RimeFormError } from '#lib/core/errors/index.js';
import type { DataType } from '#lib/core/fields/builders/form-field-builder.js';
import { FormFieldBuilder } from '#lib/core/fields/builders/form-field-builder.js';
import type { DefaultValueFn, FormField } from '#lib/fields/types.js';
import Cell from './component/Cell.svelte';
import DateComponent from './component/Date.svelte';

export const date = (name: string) => new DateFieldBuilder(name);

/** A date sent as a string or a timestamp becomes a `Date`; `null` and `undefined` stay empty. */
const toDate = (value: unknown) => {
  if (value === null || value === undefined) return value;
  return new Date(value as string | number | Date);
};

export class DateFieldBuilder extends FormFieldBuilder<DateField> {
  constructor(name: string) {
    super(name, 'date');
    this.field.defaultValue = () => new Date();
    // `toDate` runs first: an unparsable string arrives here as an Invalid Date
    this.field.validate = (value) =>
      (value instanceof Date && !isNaN(value.getTime())) || RimeFormError.INVALID_DATE;
    this.field.hooks = {
      beforeValidate: [toDate]
    };
  }

  get dataType(): DataType {
    return 'timestamp';
  }

  get component() {
    return DateComponent;
  }

  get cell() {
    return Cell;
  }

  isTitle() {
    this.field.isTitle = true;
    return this;
  }

  protected override generateType(): string {
    return `${this.name}${this.get.required ? '' : '?'}: Date`;
  }
}

/****************************************************/
/* Type
/****************************************************/
export type DateField = FormField & {
  type: 'date';
  defaultValue?: Date | DefaultValueFn<Date>;
  isTitle?: true;
};
