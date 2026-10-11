import type { DefaultValueFn, FormField, OptionWithIcon } from '#lib/fields/types.js';
import { PickOneFieldBuilder } from '../../core/fields/builders/select-builder.js';
import Combobox from './component/ComboBox.svelte';

export class ComboBoxFieldBuilder extends PickOneFieldBuilder<ComboBoxField> {
  get component() {
    return Combobox;
  }

  options(...options: OptionWithIcon[] | string[]) {
    return super.options(...options);
  }

  protected override generateType(): string {
    return `${this.name}${this.get.required ? '' : '?'}: ${this.optionsType()}`;
  }
}

export const combobox = (name: string) => new ComboBoxFieldBuilder(name, 'combobox');

/****************************************************/
/* Type
/****************************************************/
export type ComboBoxField = FormField & {
  type: 'combobox';
  options: OptionWithIcon[];
  defaultValue: string | DefaultValueFn<string>;
};
