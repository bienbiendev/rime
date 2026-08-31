import type { Component } from 'svelte';
import type { Field, FieldAccess } from '../../../fields/types.js';

/**
 * Strips FieldBuilder wrappers off a config tree, yielding the compiled field shape.
 *
 * Defined here rather than in ../types.ts because it is mutually recursive with FieldBuilder
 * below — separating them would only mean the two files importing each other. ../types.ts
 * re-exports it, so the concept still has one public entry point.
 */
export type WithoutBuilders<T> =
  T extends FieldBuilder<infer F>
    ? WithoutBuilders<F>
    : T extends Array<infer U>
      ? U extends FieldBuilder<infer F>
        ? F[]
        : U extends { compile(): infer R }
          ? R[]
          : Array<WithoutBuilders<U>>
      : T extends object
        ? T extends Function
          ? T
          : { [K in keyof T]: WithoutBuilders<T[K]> }
        : T;

/** Method-syntax (not `foo: () => ...` property syntax) so subtype checks
 *  like `FormFieldBuilder<SlugField> -> FormFieldBuilder<FormField>` — used
 *  all over the panel, where a concrete field builder flows into a
 *  generically-typed prop — stay bivariant on their params, exactly like the
 *  class methods this replaced. Property syntax would make TS check those
 *  params strictly/contravariantly and break that assignability. */
export type FieldUse = {
  accessRead(...args: Parameters<FieldAccess>): boolean;
  accessCreate(...args: Parameters<FieldAccess>): boolean;
  accessUpdate(...args: Parameters<FieldAccess>): boolean;
  generateType(): string;
};

export class FieldBuilder<T extends Field = Field> {
  field: T;

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

  /**
   * Raw field data, plus the couple of properties that a bare `this.field`
   * read can't give you: `localized`/`root` default to `false` here since
   * only FormFieldBuilder fields ever set them — container fields like Tabs
   * answer `false` rather than making every caller check
   * `instanceof FormFieldBuilder` first just to ask this one question.
   * Everything else on `T` (Tabs' `tabs`, Blocks' `blocks`, ...) comes
   * through unchanged via the spread — no per-subclass override needed.
   */
  get get(): T & { localized: boolean; root: boolean } {
    return { ...this.field, localized: false, root: false } as T & {
      localized: boolean;
      root: boolean;
    };
  }

  /** Behavior the builder runs on your behalf (invoking a stored function) —
   *  see `.get` for plain data reads. Fields without an access concept
   *  (Tabs) default every check to allowed, matching how the field-less case
   *  already behaved. Params are unused here but must match FormFieldBuilder's
   *  override signature — TS checks generic-constraint satisfaction
   *  (`T extends FieldBuilder<any>`) strictly, not with the bivariant
   *  leniency normal overrides get, so a param-less base signature breaks
   *  assignability everywhere. */
  get use(): FieldUse {
    return {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      accessRead: (..._args: Parameters<FieldAccess>): boolean => true,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      accessCreate: (..._args: Parameters<FieldAccess>): boolean => true,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      accessUpdate: (..._args: Parameters<FieldAccess>): boolean => true,
      generateType: (): string => this.generateType()
    };
  }

  get component(): Component<any> | null {
    return null;
  }

  get cell(): Component<{ value: any }> | null {
    return null;
  }

  /** The type-generation script's only entry point (via `.use.generateType()`) — `protected`
   *  so it never surfaces on the fluent chain (`text('title').generateType()` would be a
   *  compile error), while staying a real overridable method so every concrete field can
   *  provide its own, unlike a private `#field` which can't be polymorphically overridden. */
  protected generateType(): string {
    return '';
  }
}
