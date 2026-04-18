import { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import type { Field } from '$lib/fields/types.js';
import { isCamelCase } from '$lib/util/string.js';
import type { WithoutBuilders } from '$lib/util/types.js';
import Tabs from './component/Tabs.svelte';

export const tabs = (...tabs: TabBuilder[]) => new TabsBuilder(...tabs);
export const tab = (name: string) => new TabBuilder(name);

export class TabsBuilder extends FieldBuilder<TabsField> {
  //
  _metaUrl = import.meta.url;

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

  get raw() {
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

/**
 * Checks if a field is a tabs field (raw type).
 */
export const isTabsFieldRaw = (field: Field): field is TabsFieldRaw => field.type === 'tabs';

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

export type TabsFieldRaw = Field & {
  type: 'tabs';
  name: string;
  label?: string;
  tabs: Array<Omit<TabsFieldTab, 'fields'> & { fields: Field[] }>;
};
