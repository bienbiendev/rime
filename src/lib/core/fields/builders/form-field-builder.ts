import type { FieldPanelTableConfig } from '#lib/types.js';
import { makeDocTypeName } from '#lib/core/prototype/naming.js';
import { capitalize } from '#lib/util/string.js';
import type { Dic } from '#lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import cloneDeep from 'clone-deep';
import type {
  DefaultOptions,
  DefaultValueFn,
  FieldAccess,
  FieldHook,
  FieldHookClient,
  FieldHookContext,
  FieldHookDuplicate,
  FieldHookShared,
  FieldValidationFunc,
  FieldWidth,
  FormField
} from '../../../fields/types.js';
import { FieldBuilder, type FieldNode, type FieldUse, type ValueNode } from './field-builder.js';

/** Adapter-agnostic storage primitive — column syntax only, not default-value semantics. */
export type DataType = 'text' | 'boolean' | 'number' | 'timestamp' | 'json';

/** Method-syntax, same reasoning as `FieldUse`: keeps the params bivariant
 *  across concrete field types, so e.g. `SlugFieldBuilder` still satisfies a
 *  prop typed `FormFieldBuilder<FormField>`. */
export type FormFieldUse<T extends FormField> = FieldUse & {
  isEmpty(value: unknown): boolean;
  validate(value: unknown, context: Parameters<FieldValidationFunc<T>>[1]): true | string;
  isVisible(doc: Dic, siblings: Dic): boolean;
  onChange(value: unknown, context: Parameters<FieldHookClient>[1]): void;
  beforeRead(value: unknown, context: Omit<FieldHookContext<T>, 'config'>): Promise<any>;
  beforeSave(value: unknown, context: FieldHookContext<T>): Promise<any>;
  beforeValidate(value: unknown, context: Parameters<FieldHookShared>[1]): Promise<any>;
  beforeDuplicate(
    value: unknown,
    context: Omit<Parameters<FieldHookDuplicate<T>>[1], 'config'>
  ): Promise<any>;
  /** Resolves `field.defaultValue` — calling it if it's a `DefaultValueFn`,
   *  returning it as-is otherwise. Every field type stores `defaultValue` as
   *  plain data (never a fluent-setter name collision on `.field` itself),
   *  but every form field builder *does* expose a `.defaultValue(...)` fluent
   *  setter — bare `config.defaultValue` on a builder would silently return
   *  that setter, not the stored value. */
  defaultValue(context?: { event?: RequestEvent }): unknown;
};

export type ReferentialAction = 'cascade' | 'set null' | 'restrict' | 'no action';

export type FieldReferenceOptions = {
  onDelete?: ReferentialAction;
  onUpdate?: ReferentialAction;
  /** Referenced table is this field's own table (self-FK); adapters need this
   *  to emit a `(): any =>` accessor and avoid a TS circular-declaration error. */
  selfReferencing?: boolean;
  /**
   * Read back as the referenced document instead of its id, joined by the adapter. Written as
   * the id either way: a save may send the document back as it came.
   *
   * ```ts
   * text('updatedBy').$references('staff', { resolve: true });
   * // reads  { updatedBy: { id: 'abc', name: 'Ann', email: 'ann@x.io' } }
   * // writes { updatedBy: 'abc' }
   * ```
   */
  resolve?: boolean;
};

export type FieldReference = FieldReferenceOptions & { table: string };

export class FormFieldBuilder<T extends FormField = FormField> extends FieldBuilder<T> {
  /** Column storage type, used to generate the DB schema. Every field
   *  builder that stores data must define its own. */
  get dataType(): DataType {
    throw new Error(`${this.constructor.name} does not implement dataType`);
  }

  _references: FieldReference | null = null;

  constructor(name: string, type: string) {
    super(type);
    this.field.name = name;
    this.field.hooks = {};
    this.field.defaultValue = null;
    this.field.isEmpty = (value) => !value;
    this.field.access = {
      create: (user) => !!user,
      update: (user) => !!user,
      read: () => true
    };
    return this;
  }

  label(label: string) {
    this.field.label = label;
    return this;
  }

  hidden() {
    this.field.hidden = true;
    return this;
  }

  /**
   * The value a new document starts with, or a function that answers it.
   * With `{ fill: 'save' }`, a save that leaves the field empty also gets it.
   */
  defaultValue(value: NonNullable<T['defaultValue']>, options?: DefaultOptions) {
    this.field.defaultValue = value;
    this.field.defaultFill = options?.fill;
    return this;
  }

  localized() {
    this.field.localized = true;
    return this;
  }

  /**
   * Adds a rule to the field's own check. The value reaches `rule` only once the field type's
   * check (a number, an address, an option of the list) accepts it; `true` passes, a string is the
   * message.
   *
   * ```ts
   * number('age').min(0).validate((value) => Number.isInteger(value) || 'Whole years');
   * // -5 -> 'Should be greater than 0'   2.5 -> 'Whole years'   7 -> true
   * ```
   */
  validate(rule: FieldValidationFunc<T>) {
    const own = this.field.validate;
    this.field.validate = ((value, context) => {
      const checked = own ? own(value, context) : true;
      return checked === true ? rule(value, context) : checked;
    }) as FieldValidationFunc<T>;
    return this;
  }

  condition(conditionFunction: (doc: Dic, siblings: Dic) => boolean) {
    this.field.condition = conditionFunction;
    return this;
  }

  table(params?: FieldPanelTableConfig | number) {
    if (params === undefined) {
      this.field.table = { position: 99 };
    } else if (typeof params === 'number') {
      this.field.table = { position: params };
    } else {
      this.field.table = params;
    }
    return this;
  }

  width(value: FieldWidth) {
    this.field.width = value;
    return this;
  }

  required(bool?: boolean) {
    this.field.required = typeof bool === 'undefined' ? true : bool;
    return this;
  }

  /**
   * Keeps the field on the base row of a versioned config, so every version shares it.
   * `_parent` on a nested collection is the typical case: the site tree must not fork per version.
   */
  $root() {
    this.field.root = true;
    return this;
  }

  /**
   * Indexes the field's column, for a field a list is filtered or sorted by.
   *
   * ```ts
   * text('sku').$index()   // where[sku][equals]=… reads the index, not every row
   * ```
   */
  $index() {
    this.field.index = true;
    return this;
  }

  /** `label`/`localized`/`root`/`required` are the only properties that need
   *  anything beyond a plain `this.field` read (a fallback default, or a
   *  boolean coercion) — everything else a concrete field type adds
   *  (Group's `fields`, Relation's `relationTo`, Select's `options`, ...)
   *  comes through unchanged via the spread, no per-subclass override needed. */
  override get get(): T & {
    localized: boolean;
    root: boolean;
    label: string;
    required: boolean;
  } {
    return {
      ...this.field,
      localized: !!this.field.localized,
      root: !!this.field.root,
      label: this.field.label || capitalize(this.field.name),
      required: !!this.field.required
    } as T & { localized: boolean; root: boolean; label: string; required: boolean };
  }

  access(access: { create?: FieldAccess; read?: FieldAccess; update?: FieldAccess }) {
    this.field.access = { ...this.field.access, ...access };
    return this;
  }

  onChange(hook: FieldHookClient) {
    this.field.hooks!.onChange ??= [];
    this.field.hooks!.onChange.push(hook);
    return this;
  }

  /** Behavior the builder runs on your behalf — invoking a stored function or
   *  hook list, not a data read (see `.get` for that). */
  override get use(): FormFieldUse<T> {
    return {
      isEmpty: (value: unknown): boolean => this.field.isEmpty(value),
      validate: (value: unknown, context: Parameters<FieldValidationFunc<T>>[1]): true | string => {
        // An empty value has nothing to check: `required` reports it when the field needs one
        if (value === null || value === undefined || value === '') return true;
        if (this.field.validate) {
          return this.field.validate(value, { ...context, config: this.field });
        }
        return true;
      },
      isVisible: (doc: Dic, siblings: Dic): boolean => {
        if (this.field.condition) {
          try {
            return this.field.condition(doc, siblings);
          } catch (err: any) {
            console.error(err.message);
            return false;
          }
        }
        return true;
      },
      accessRead: (...args: Parameters<FieldAccess>): boolean =>
        !!this.field.access?.read?.(...args),
      accessCreate: (...args: Parameters<FieldAccess>): boolean =>
        !!this.field.access?.create?.(...args),
      accessUpdate: (...args: Parameters<FieldAccess>): boolean =>
        !!this.field.access?.update?.(...args),
      onChange: (value: unknown, context: Parameters<FieldHookClient>[1]): void => {
        for (const hook of this.field.hooks?.onChange ?? []) {
          hook(value, context);
        }
      },
      beforeRead: async (
        value: unknown,
        context: Omit<FieldHookContext<T>, 'config'>
      ): Promise<any> => {
        let result = value;
        for (const hook of this.field.hooks?.beforeRead ?? []) {
          result = await hook(result, { ...context, config: this.field });
        }
        return result;
      },
      beforeSave: async (value: unknown, context: FieldHookContext<T>): Promise<any> => {
        let result = value;
        for (const hook of this.field.hooks?.beforeSave ?? []) {
          result = await hook(result, { ...context, config: this.field });
        }
        return result;
      },
      beforeValidate: async (
        value: unknown,
        context: Parameters<FieldHookShared>[1]
      ): Promise<any> => {
        let result = value;
        for (const hook of this.field.hooks?.beforeValidate ?? []) {
          result = await hook(result, { ...context, config: this.field });
        }
        return result;
      },
      beforeDuplicate: async (
        value: unknown,
        context: Omit<Parameters<FieldHookDuplicate<T>>[1], 'config'>
      ): Promise<any> => {
        let result = value;
        for (const hook of this.field.hooks?.beforeDuplicate ?? []) {
          result = await hook(result, { ...context, config: this.field });
        }
        return result;
      },
      defaultValue: (context: { event?: RequestEvent } = {}): unknown => {
        const value = this.field.defaultValue;
        return typeof value === 'function' ? (value as DefaultValueFn<unknown>)(context) : value;
      },
      generateType: (): string =>
        this._references?.resolve ? this.resolvedReferenceType() : this.generateType(),
      nodes: (): FieldNode[] => this.nodes(),
      nodesFor: (value: unknown): ValueNode[] => this.nodesFor(value)
    };
  }

  /** The document a resolved reference reads as, whatever the field's own type says. */
  private resolvedReferenceType(): string {
    const shared = [
      '//@shared:start ResolvedReference',
      "export type ResolvedReference<T> = (Pick<T, 'id'> & Partial<T>) | null;",
      '//@shared:end'
    ].join('\n');
    const target = makeDocTypeName(this._references!.table);
    return [
      shared,
      `${this.field.name}${this.get.required ? '' : '?'}: ResolvedReference<${target}>`
    ].join('\n');
  }

  hint(hint: string) {
    this.field.hint = hint;
    return this;
  }

  /** A copy of the builder: its field, deep, and its `$references`. */
  clone(): typeof this {
    const Constructor = this.constructor as new (...args: any[]) => typeof this;
    const clone = new Constructor(this.field.name, this.field.type);
    clone.field = cloneDeep(this.field);
    clone._references = this._references ? { ...this._references } : null;
    return clone;
  }

  /**
   * Makes this field a foreign key to the prototype `table` names (a slug). With `resolve`, a read
   * joins the referenced document.
   */
  $references(table: string, options?: FieldReferenceOptions) {
    this._references = { table, ...options };
    return this;
  }

  $beforeRead(hook: FieldHook<T>) {
    this.field.hooks!.beforeRead ??= [];
    this.field.hooks!.beforeRead.push(hook);
    return this;
  }

  $beforeSave(hook: FieldHook<T>) {
    this.field.hooks!.beforeSave ??= [];
    this.field.hooks!.beforeSave.push(hook);
    return this;
  }

  beforeValidate(hook: FieldHookShared) {
    this.field.hooks!.beforeValidate ??= [];
    this.field.hooks!.beforeValidate.push(hook);
    return this;
  }

  /**
   * The value this field takes on a copy of its document. It runs after the field's own copy and
   * gets its value: a text title already reads `Title (copy)`.
   *
   * ```ts
   * text('code').$beforeDuplicate(() => null)
   * text('title').isTitle().$beforeDuplicate((title) => title.toUpperCase())  // 'TITLE (COPY)'
   * email('contact').unique().$beforeDuplicate(() => null)
   * ```
   */
  $beforeDuplicate(hook: FieldHookDuplicate<T>) {
    this.field.hooks!.beforeDuplicate ??= [];
    this.field.hooks!.beforeDuplicate.push(hook);
    return this;
  }

  /** Fallback for a data-bearing field that doesn't override this: still shows up in the
   *  generated document type (as `any`) instead of silently vanishing from it. */
  protected override generateType(): string {
    return `${this.field.name}${this.get.required ? '' : '?'}: any`;
  }
}
