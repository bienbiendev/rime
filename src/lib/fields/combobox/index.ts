import type { DefaultValueFn, FormField, OptionWithIcon } from '$lib/fields/types.js';
import { PickOneFieldBuilder } from '../../core/fields/builders/select.js';
import Combobox from './component/ComboBox.svelte';

export class ComboBoxFieldBuilder extends PickOneFieldBuilder<ComboBoxField> {
  //
  _metaUrl: string = import.meta.url;

  get component() {
    return Combobox;
  }

  options(...options: OptionWithIcon[] | string[]) {
    return super.options(...options);
  }

  defaultValue(value: string | DefaultValueFn<string>) {
    this.field.defaultValue = value;
    return this;
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
  unique?: boolean;
};
