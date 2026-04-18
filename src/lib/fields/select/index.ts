import type { DefaultValueFn, Field, FormField, Option } from '$lib/fields/types.js';
import { PickManyFieldBuilder } from '../../core/fields/builders/select.js';
import Select from './component/Select.svelte';

export class SelectFieldBuilder extends PickManyFieldBuilder<SelectField> {
  _metaUrl = import.meta.url;

  get component() {
    return Select;
  }
}

export const select = (name: string) => new SelectFieldBuilder(name, 'select');

/**
 * Checks if a field is a select field.
 */
export const isSelectField = (field: Field): field is SelectField => field.type === 'select';

/****************************************************/
/* Type
/****************************************************/

export type SelectField = FormField & {
  type: 'select';
  options: Option[];
  defaultValue?: string[] | DefaultValueFn<string[]>;
  many?: boolean;
};
