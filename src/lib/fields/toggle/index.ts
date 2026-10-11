import { BooleanFieldBuilder } from '#lib/core/fields/builders/boolean-builder.js';
import type { DefaultValueFn, FormField } from '#lib/fields/types.js';
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
