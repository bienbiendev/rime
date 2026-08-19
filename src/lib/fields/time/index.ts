import type { DataType } from '$lib/core/fields/builders/form-field-builder.js';
import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import type { DefaultValueFn, FormField } from '$lib/fields/types.js';
import TimeComponent from './component/Time.svelte';

export const time = (name: string) => new TimeFieldBuilder(name);

export class TimeFieldBuilder extends FormFieldBuilder<TimeField> {
  constructor(name: string) {
    super(name, 'time');
    this.field.defaultValue = '08:00';
    this.field.validate = (value) => {
      if (typeof value === 'string' && /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
        return true;
      }
      return 'incorrect time format ' + value;
    };
  }

  get component() {
    return TimeComponent;
  }

  defaultValue(value: string | DefaultValueFn<string>) {
    this.field.defaultValue = value;
    return this;
  }

  get dataType(): DataType {
    return 'text';
  }

  protected override generateType(): string {
    return `${this.name}${!this.get.required ? '?' : ''}: string`;
  }
}

/****************************************************/
/* Type
/****************************************************/
export type TimeField = FormField & {
  type: 'time';
  defaultValue?: string | DefaultValueFn<string>;
  unique?: boolean;
};
