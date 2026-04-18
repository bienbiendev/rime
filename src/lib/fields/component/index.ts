import { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import type { Field, FieldAccess } from '$lib/fields/types.js';
import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
import type { GenericDoc } from '$lib/types.js';
import type { WithOptional } from '$lib/util/types.js';
import type { Component } from 'svelte';

type TypedComponent = Component<{
  path: string;
  config: ComponentField;
  form: DocumentFormContext<WithOptional<GenericDoc, 'id'>>;
}>;

export const component = (component: TypedComponent) => new ComponentFieldBuilder(component);

export class ComponentFieldBuilder extends FieldBuilder<ComponentField> {
  //
  constructor(component: TypedComponent) {
    super('component');
    this.field.component = component;
  }
  condition(func: (doc: any) => boolean) {
    this.field.condition = func;
    return this;
  }
  access(access: { create: FieldAccess; read: FieldAccess; update: FieldAccess }) {
    this.field.access = access;
    return this;
  }
}

/****************************************************/
/* Types
/****************************************************/

export type ComponentField = Field & {
  type: 'component';
  component: TypedComponent;
};
