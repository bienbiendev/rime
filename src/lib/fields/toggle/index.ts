import { BooleanFieldBuilder } from '$lib/core/fields/builders/boolean.js';
import type { DefaultValueFn, FormField } from '$lib/fields/types.js';
import Cell from './component/Cell.svelte';
import Toggle from './component/Toggle.svelte';

export class ToggleFieldBuilder extends BooleanFieldBuilder<ToggleField> {
  //
  _metaUrl = import.meta.url;

  constructor(name: string) {
    super(name, 'toggle');
    this.field.isEmpty = (value) => typeof value !== 'boolean';
    this.field.defaultValue = false;
  }

  get component() {
    return Toggle;
  }

  get cell() {
    return Cell;
  }

  defaultValue(value: boolean | DefaultValueFn<boolean>) {
    this.field.defaultValue = value;
    return this;
  }

  compile() {
    if (!this.field.validate) {
      this.field.validate = (value: any) => {
        return typeof value === 'boolean' || 'Should be a boolean';
      };
    }
    return super.compile();
  }
}

export const toggle = (name: string) => new ToggleFieldBuilder(name);

/****************************************************/
/* Type
/****************************************************/

export interface ToggleField extends FormField {
  type: 'toggle';
  defaultValue?: boolean | DefaultValueFn<boolean>;
}
