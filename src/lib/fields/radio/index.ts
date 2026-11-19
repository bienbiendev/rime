import type { DefaultValueFn, FormField, Option } from '#lib/fields/types.js';
import type { Component } from 'svelte';
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

  /**
   * `row` shows the options as one segmented row, `default` as a list of radios, `cards` as a grid
   * of cards, each option's thumbnail above its label.
   */
  layout(value: 'default' | 'row' | 'cards') {
    this.field.layout = value;
    return this;
  }

  /**
   * The options to pick from. With the `cards` layout, an option may carry a thumbnail: a Svelte
   * component drawn above its label.
   *
   * ```ts
   * import HeroSplit from './thumbnails/HeroSplit.svelte'
   * radio('layout').layout('cards').options({ value: 'split', label: 'Côte à côte', thumbnail: HeroSplit })
   * ```
   */
  override options(...options: (RadioOption | string)[]) {
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

/** An option, with the thumbnail its card shows in the `cards` layout. */
export type RadioOption = Option & { thumbnail?: Component };

export type RadioField = FormField & {
  type: 'radio';
  options: RadioOption[];
  layout: 'row' | 'default' | 'cards';
  defaultValue: string | DefaultValueFn<string>;
  many: false;
};
