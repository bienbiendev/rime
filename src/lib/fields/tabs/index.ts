import {
  FieldBuilder,
  type FieldNode,
  type ValueNode
} from '$lib/core/fields/builders/field-builder.js';
import type { Field } from '$lib/fields/types.js';
import { isObjectLiteral } from '$lib/util/object.js';
import { isCamelCase, joinMemberTypes } from '$lib/util/string.js';
import type { WithoutBuilders } from '$lib/core/fields/types.js';
import Tabs from './component/Tabs.svelte';

export const tabs = (...tabs: TabBuilder[]) => new TabsBuilder(...tabs);
export const tab = (name: string) => new TabBuilder(name);

export class TabsBuilder extends FieldBuilder<TabsField> {
  constructor(...tabs: TabBuilder[]) {
    super('tabs');
    this.field.tabs = tabs;
  }

  get component() {
    return Tabs;
  }

  override compile() {
    return {
      ...this.field,
      tabs: this.field.tabs.map((tab) => tab.compile()),
      component: this.component,
      cell: this.cell || undefined
    };
  }

  protected override generateType(): string {
    const types: string[] = [];
    for (const tab of this.field.tabs) {
      const fieldsTypes = joinMemberTypes(tab.get.fields.map((field) => field.use.generateType()));
      if (fieldsTypes) {
        types.push(`${tab.name}: {${fieldsTypes}}`);
      }
    }
    return types.join(',\n');
  }

  /** The builder has no name of its own, so each tab's name is the whole segment. */
  protected override nodes(): FieldNode[] {
    return this.field.tabs.map((tab) => ({ segment: tab.name, fields: tab.get.fields }));
  }

  protected override nodesFor(value: unknown): ValueNode[] {
    if (!isObjectLiteral(value)) return [];
    return this.field.tabs
      .filter((tab) => tab.name in value)
      .map((tab) => ({ segment: tab.name, fields: tab.get.fields, value: value[tab.name] }));
  }
}

export class TabBuilder {
  #tab: TabsFieldTab;

  constructor(name: string) {
    if (!isCamelCase(name)) throw new Error('Tab name should be camelCase');
    this.#tab = { name, label: name, fields: [], live: true };
  }

  label(label: string) {
    this.#tab.label = label;
    return this;
  }

  get name() {
    return this.#tab.name;
  }

  fields(...fields: FieldBuilder<Field>[]) {
    this.#tab.fields = fields;
    return this;
  }

  get get() {
    return { ...this.#tab };
  }

  compile(): WithoutBuilders<TabsFieldTab> {
    return { ...this.#tab, fields: this.#tab.fields.map((f) => f.compile()) };
  }

  live(bool: boolean) {
    this.#tab.live = bool;
    return this;
  }
}

/**
 * Checks if a field is a tabs field.
 */
export const isTabsField = (field: Field): field is TabsField => field.type === 'tabs';

/****************************************************/
/* Types
/****************************************************/

export type TabsField = Field & {
  type: 'tabs';
  tabs: TabBuilder[];
};

export type TabsFieldTab = {
  name: string;
  label?: string;
  live: boolean;
  fields: FieldBuilder<Field>[];
};
