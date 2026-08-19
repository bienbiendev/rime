import type { FormField } from '$lib/fields/types.js';
import { BooleanFieldBuilder } from '../../core/fields/builders/boolean-builder.js';
import Checkbox from './component/Checkbox.svelte';

export class CheckboxFieldBuilder extends BooleanFieldBuilder<CheckboxField> {
  get component() {
    return Checkbox;
  }

  protected override generateType(): string {
    return `${this.name}: boolean`;
  }
}

export const checkbox = (name: string) => new CheckboxFieldBuilder(name, 'checkbox');

/****************************************************/
/* Type
/****************************************************/
export type CheckboxField = FormField & {
  type: 'checkbox';
  defaultValue?: boolean;
};
