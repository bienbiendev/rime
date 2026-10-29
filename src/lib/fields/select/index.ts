import type { DataType } from '#lib/core/fields/builders/form-field-builder.js';
import type { DefaultValueFn, FormField, Option } from '#lib/fields/types.js';
import { PickManyFieldBuilder } from '../../core/fields/builders/select-builder.js';
import Select from './component/Select.svelte';

export class SelectFieldBuilder extends PickManyFieldBuilder<SelectField> {
  get component() {
    return Select;
  }

  get dataType(): DataType {
    return this.field.many ? 'json' : 'text';
  }

  protected override generateType(): string {
    return `${this.name}${this.get.required ? '' : '?'}: (${this.optionsType()})${this.get.many ? '[]' : ''}`;
  }
}

/** A pick among options: one, stored as text, or several with `.many()`, stored as a JSON list. */
export const select = (name: string) => new SelectFieldBuilder(name, 'select');

/****************************************************/
/* Type
/****************************************************/

export type SelectField = FormField & {
  type: 'select';
  options: Option[];
  defaultValue?: string[] | DefaultValueFn<string[]>;
  many?: boolean;
};
