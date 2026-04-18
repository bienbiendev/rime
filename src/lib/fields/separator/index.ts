import { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import type { Field } from '$lib/fields/types.js';
import Separator from './component/Separator.svelte';

class SeparatorFieldBuilder extends FieldBuilder<SeparatorField> {
  get component() {
    return Separator;
  }
}

export const separator = () => new SeparatorFieldBuilder('separator');

/****************************************************/
/* Type
/****************************************************/
export type SeparatorField = Field & {
  type: 'separator';
};
