import type { FormField } from '$lib/fields/types.js';
import { BooleanFieldBuilder } from '../../core/fields/builders/boolean.js';
import Checkbox from './component/Checkbox.svelte';

export class CheckboxFieldBuilder extends BooleanFieldBuilder<CheckboxField> {
  //
  _metaUrl: string = import.meta.url;

  get component() {
    return Checkbox;
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
