import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import type { DefaultValueFn, FormField } from '$lib/fields/types.js';
import Cell from './component/Cell.svelte';
import DateComponent from './component/Date.svelte';

export const date = (name: string) => new DateFieldBuilder(name);

const stringToDate = (value: string) => {
  return new Date(value);
};

export class DateFieldBuilder extends FormFieldBuilder<DateField> {
  //
  _metaUrl: string = import.meta.url;

  constructor(name: string) {
    super(name, 'date');
    this.field.hooks = {
      beforeValidate: [stringToDate]
    };
  }

  get component() {
    return DateComponent;
  }

  get cell() {
    return Cell;
  }

  defaultValue(value: Date | DefaultValueFn<Date>) {
    this.field.defaultValue = value;
    return this;
  }

  isTitle() {
    this.field.isTitle = true;
    return this;
  }
}

/****************************************************/
/* Type
/****************************************************/
export type DateField = FormField & {
  type: 'date';
  defaultValue?: Date | DefaultValueFn<Date>;
  unique?: boolean;
  isTitle?: true;
};
