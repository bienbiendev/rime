import type { DataType } from '$lib/core/fields/builders/form-field-builder.js';
import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import type { DefaultValueFn, FormField } from '$lib/fields/types.js';
import Cell from './component/Cell.svelte';
import DateComponent from './component/Date.svelte';

export const date = (name: string) => new DateFieldBuilder(name);

const stringToDate = (value: string) => {
  return new Date(value);
};

export class DateFieldBuilder extends FormFieldBuilder<DateField> {
  constructor(name: string) {
    super(name, 'date');
    this.field.defaultValue = () => new Date();
    this.field.hooks = {
      beforeValidate: [stringToDate]
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

  defaultValue(value: Date | DefaultValueFn<Date>) {
    this.field.defaultValue = value;
    return this;
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
  unique?: boolean;
  isTitle?: true;
};
