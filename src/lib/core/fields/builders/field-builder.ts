import type { WithoutBuilders } from '$lib/util/types.js';
import type { Component } from 'svelte';
import type { Field, FieldAccess } from '../../../fields/types.js';

export class FieldBuilder<T extends Field = Field> {
  field: T;
  _metaUrl?: string;

  constructor(type: string) {
    this.field = {
      name: '',
      type,
      live: true
    } as T;
  }

  get name() {
    return this.field.name;
  }

  className(str: string) {
    this.field.className = str;
    return this;
  }

  compile(): WithoutBuilders<T> & {
    component: Component<any>;
    cell?: Component<{ value: any }> | null;
  } {
    return {
      ...this.field,
      component: this.component,
      cell: this.cell || undefined
    } as WithoutBuilders<T> & {
      component: Component<any>;
      cell?: Component<{ value: any }> | null;
    };
  }

  live(bool: boolean) {
    this.field.live = bool;
    return this;
  }

  get type() {
    return this.field.type;
  }

  get raw(): T {
    return this.field;
  }

  /**
   * Reads a raw data property by key — safe against fields where a
   * same-named fluent setter shadows the data (e.g. `.localized`, `.fields`,
   * `._root` are all methods, so `field.localized` is the function, not the
   * boolean). Needs the same narrowing `.raw.x` would: only valid once `T`
   * is concrete (e.g. after an `instanceof` check), not on a generic
   * `FieldBuilder<Field>`. `__`-prefixed like the other internal readers
   * below, so it doesn't show up next to the fluent config methods.
   */
  __get<K extends keyof T>(key: K): T[K] {
    return this.field[key];
  }

  /** Only FormFieldBuilder can ever be root (see override there) — container
   *  fields like Tabs answer `false` rather than making every caller check
   *  `instanceof FormFieldBuilder` first just to ask this one question. */
  get __root(): boolean {
    return false;
  }

  /** Same reasoning as __root: `localized()` is a fluent setter, so bare
   *  `field.localized` (no `.raw`) silently reads the method, not the
   *  boolean. Container fields (Tabs) answer `false` by default. */
  get __localized(): boolean {
    return false;
  }

  /** Same reasoning again, for `.access` — only FormFieldBuilder has one
   *  (see overrides there). Fields without an access concept (Tabs) default
   *  to allowed, matching how the field-less case already behaved. Params
   *  are unused here but must match FormFieldBuilder's override signature —
   *  TS checks generic-constraint satisfaction (`T extends FieldBuilder<any>`)
   *  strictly, not with the bivariant leniency normal overrides get, so a
   *  param-less base signature breaks assignability everywhere. */

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  __canRead(..._args: Parameters<FieldAccess>): boolean {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  __canCreate(..._args: Parameters<FieldAccess>): boolean {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  __canUpdate(..._args: Parameters<FieldAccess>): boolean {
    return true;
  }

  get component(): Component<any> | null {
    return null;
  }

  get cell(): Component<{ value: any }> | null {
    return null;
  }
}
