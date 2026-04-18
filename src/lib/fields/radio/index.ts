import type { DefaultValueFn, FormField, Option } from '$lib/fields/types.js';
import { PickOneFieldBuilder } from '../../core/fields/builders/select.js';
import Radio from './component/Radio.svelte';

export class RadioFieldBuilder extends PickOneFieldBuilder<RadioField> {
  //
  _metaUrl = import.meta.url;

  constructor(name: string) {
    super(name, 'radio');
    this.field.many = false;
    this.field.layout = 'default';
  }

  get component() {
    return Radio;
  }

  layout(value: 'default' | 'row') {
    this.field.layout = value;
    return this;
  }

  compile() {
    super.compile();
    if (!this.field.defaultValue) {
      const defaultOption = this.field.options[0].value;
      this.field.defaultValue = defaultOption;
    }
    return this.field;
  }
}

export const radio = (name: string) => new RadioFieldBuilder(name);

/****************************************************/
/* Type
/****************************************************/

export type RadioField = FormField & {
  type: 'radio';
  options: Option[];
  layout: 'row' | 'default';
  defaultValue: string | DefaultValueFn<string>;
  many: false;
};
