import { BooleanFieldBuilder } from '$lib/core/fields/builders/boolean-builder.js';
import type { DefaultOptions, DefaultValueFn, FormField } from '$lib/fields/types.js';
import Cell from './component/Cell.svelte';
import Toggle from './component/Toggle.svelte';

export class ToggleFieldBuilder extends BooleanFieldBuilder<ToggleField> {
  constructor(name: string) {
    super(name, 'toggle');
  }

  get component() {
    return Toggle;
  }

  get cell() {
    return Cell;
  }

  defaultValue(value: boolean | DefaultValueFn<boolean>, options?: DefaultOptions) {
    this.field.defaultValue = value;
    this.field.defaultFill = options?.fill;
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

  protected override generateType(): string {
    return `${this.name}${this.get.required ? '' : '?'}: boolean`;
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
