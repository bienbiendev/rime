import type {
  FieldBuilder,
  FieldNode,
  ValueNode
} from '#lib/core/fields/builders/field-builder.js';
import { joinMemberTypes } from '#lib/util/string.js';
import { FormFieldBuilder } from '#lib/core/fields/builders/form-field-builder.js';
import { localizeFields } from '#lib/core/fields/localize.js';
import type { Field, FieldsPreviewProps, FormField } from '#lib/fields/types.js';
import type { Component } from 'svelte';
import Group from './component/Group.svelte';

const isEmpty = (value: unknown) =>
  !!value === false ||
  (typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value).length === 0);

export class GroupFieldBuilder extends FormFieldBuilder<GroupField> {
  constructor(name: string) {
    super(name, 'group');
    this.field.isEmpty = isEmpty;
  }

  get component() {
    return Group;
  }

  label(label: string) {
    this.field.label = label;
    return this;
  }

  fields(...fields: FieldBuilder<Field>[]) {
    this.field.fields = this.field.localized ? localizeFields(fields) : fields;
    return this;
  }

  /** The group and every field in it localized, whichever of `fields()` and this comes first. */
  localized() {
    this.field.localized = true;
    this.field.fields = localizeFields(this.field.fields ?? []);
    return this;
  }

  preview(component: Component<FieldsPreviewProps>) {
    this.field.preview = component;
    return this;
  }

  compile() {
    return { ...this.field, fields: this.field.fields.map((f) => f.compile()) };
  }

  protected override generateType(): string {
    const fieldsTypes = joinMemberTypes(this.field.fields.map((field) => field.use.generateType()));
    return fieldsTypes ? `${this.name}: {${fieldsTypes}}` : '';
  }

  /** One branch, contributing no segment: the group's own name already is one. */
  protected override nodes(): FieldNode[] {
    return [{ segment: '', fields: this.field.fields }];
  }

  protected override nodesFor(value: unknown): ValueNode[] {
    return [{ segment: '', fields: this.field.fields, value }];
  }
}

export const group = (name: string) => new GroupFieldBuilder(name);

/****************************************************/
/* Types
/****************************************************/

export type GroupField = FormField & {
  type: 'group';
  name: string;
  label?: string;
  fields: FieldBuilder<Field>[];
  preview?: Component<FieldsPreviewProps>;
};
