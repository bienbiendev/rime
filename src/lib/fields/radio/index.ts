import type { DefaultValueFn, FormField, Option } from '#lib/fields/types.js';
import { PickOneFieldBuilder } from '../../core/fields/builders/select-builder.js';
import Radio from './component/Radio.svelte';

export class RadioFieldBuilder extends PickOneFieldBuilder<RadioField> {
  constructor(name: string) {
    super(name, 'radio');
    this.field.many = false;
    this.field.layout = 'row';
  }

  get component() {
    return Radio;
  }

  layout(value: 'default' | 'row') {
    this.field.layout = value;
    return this;
  }

  override options(...options: (Option | string)[]) {
    super.options(...options);
    // A radio starts on one of its options: its first, unless its default is one of them
    const current = this.field.defaultValue;
    const isOption = this.field.options.some((option) => option.value === current);
    if (typeof current !== 'function' && !isOption) {
      this.field.defaultValue = this.field.options[0]?.value ?? null;
    }
    return this;
  }

  protected override generateType(): string {
    return `${this.name}${this.get.required ? '' : '?'}: ${this.optionsType()}`;
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
