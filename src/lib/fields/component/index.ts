import { FieldBuilder } from '#lib/core/fields/builders/field-builder.js';
import type { Dic } from '#lib/util/types.js';
import type { Field, FieldAccess } from '#lib/fields/types.js';
import type { DocumentFormContext } from '#lib/panel/context/documentForm.svelte.js';
import type { GenericDoc } from '#lib/types.js';
import type { WithOptional } from '#lib/util/types.js';
import type { Component } from 'svelte';

type TypedComponent = Component<{
  path: string;
  config: ComponentFieldBuilder;
  form: DocumentFormContext<WithOptional<GenericDoc, 'id'>>;
}>;

export const component = (component: TypedComponent) => new ComponentFieldBuilder(component);

export class ComponentFieldBuilder extends FieldBuilder<ComponentField> {
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

  /** The base checks, with read access and the condition taken from the author's config. */
  override get use() {
    return {
      ...super.use,
      accessRead: (...args: Parameters<FieldAccess>): boolean =>
        this.field.access?.read?.(...args) ?? true,
      // A component's condition takes the document only; a throw hides it
      isVisible: (doc: Dic): boolean => {
        const condition = this.field.condition as ((doc: Dic) => boolean) | undefined;
        if (!condition) return true;
        try {
          return condition(doc);
        } catch (err: any) {
          console.error(err.message);
          return false;
        }
      }
    };
  }
}

/****************************************************/
/* Types
/****************************************************/

export type ComponentField = Field & {
  type: 'component';
  component: TypedComponent;
};
