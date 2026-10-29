import {
  FieldBuilder,
  type FieldNode,
  type ValueNode
} from '#lib/core/fields/builders/field-builder.js';
import type { Field } from '#lib/fields/types.js';
import { localizeFields } from '#lib/core/fields/localize.js';
import { isObjectLiteral } from '#lib/util/object.js';
import { capitalize, isCamelCase, joinMemberTypes } from '#lib/util/string.js';
import type { WithoutBuilders } from '#lib/core/fields/types.js';
import Tabs from './component/Tabs.svelte';

/** Fields in tabs: each tab's values sit under its name, `seo.title`. */
export const tabs = (...tabs: TabBuilder[]) => new TabsBuilder(...tabs);
/** A tab, given to `tabs()`; its name is camelCase and names its values. */
export const tab = (name: string) => new TabBuilder(name);

/** Tabs of fields; the builder has no name and no value of its own. */
export class TabsBuilder extends FieldBuilder<TabsField> {
  constructor(...tabs: TabBuilder[]) {
    super('tabs');
    this.field.tabs = tabs;
  }

  get component() {
    return Tabs;
  }

  /** A copy whose tabs are copies too, so `localized()` on it leaves this one as it is. */
  clone() {
    const clone = new TabsBuilder();
    clone.field = { ...this.field, tabs: this.field.tabs.map((tab) => tab.clone()) };
    return clone;
  }

  /** Each tab's fields become localized clones. A tabs holds no value of its own. */
  localized() {
    for (const tab of this.field.tabs) {
      tab.fields(...localizeFields(tab.get.fields));
    }
    return this;
  }

  /** The config as the panel and the server read it, each tab's fields compiled too. */
  override compile() {
    return {
      ...this.field,
      tabs: this.field.tabs.map((tab) => tab.compile()),
      component: this.component,
      cell: this.cell || undefined
    };
  }

  /** One member per tab with fields: `seo: { title?: string }`. */
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

/** One tab: its name, label, fields, and whether live mode shows it. */
export class TabBuilder {
  #tab: TabsFieldTab;

  constructor(name: string) {
    if (!isCamelCase(name)) throw new Error('Tab name should be camelCase');
    this.#tab = { name, label: capitalize(name), fields: [], live: true };
  }

  /** The tab's name on screen; without it, its name capitalized. */
  label(label: string) {
    this.#tab.label = label;
    return this;
  }

  get name() {
    return this.#tab.name;
  }

  /** A copy with its own list of fields: the fields themselves are shared. */
  clone() {
    const clone = new TabBuilder(this.#tab.name);
    clone.#tab = { ...this.#tab };
    return clone;
  }

  /** The tab's fields, in place of any given before. */
  fields(...fields: FieldBuilder<Field>[]) {
    this.#tab.fields = fields;
    return this;
  }

  /** A copy of the tab's settings. */
  get get() {
    return { ...this.#tab };
  }

  compile(): WithoutBuilders<TabsFieldTab> {
    return { ...this.#tab, fields: this.#tab.fields.map((f) => f.compile()) };
  }

  /** Live mode shows the tab unless `live(false)`. */
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
