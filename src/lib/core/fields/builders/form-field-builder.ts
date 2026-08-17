import type { FieldPanelTableConfig } from '$lib/types.js';
import { capitalize } from '$lib/util/string.js';
import type { Dic } from '$lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import cloneDeep from 'clone-deep';
import type {
  DefaultValueFn,
  FieldAccess,
  FieldHook,
  FieldHookClient,
  FieldHookContext,
  FieldHookShared,
  FieldValidationFunc,
  FieldWidth,
  FormField
} from '../../../fields/types.js';
import { FieldBuilder, type FieldUse } from './field-builder.js';

/** Adapter-agnostic storage primitive — column syntax only, not default-value semantics. */
export type DataType = 'text' | 'boolean' | 'number' | 'timestamp' | 'json';

/** Method-syntax, same reasoning as `FieldUse` — keeps `run`'s params
 *  bivariant across concrete field types so e.g. `SlugFieldBuilder` still
 *  satisfies a prop typed `FormFieldBuilder<FormField>`. */
export type FormFieldUse<T extends FormField> = FieldUse & {
  isEmpty(value: unknown): boolean;
  validate(value: unknown, context: Parameters<FieldValidationFunc<T>>[1]): true | string;
  isVisible(doc: Dic, siblings: Dic): boolean;
  onChange(value: unknown, context: Parameters<FieldHookClient>[1]): void;
  beforeRead(value: unknown, context: Omit<FieldHookContext<T>, 'config'>): Promise<any>;
  beforeSave(value: unknown, context: FieldHookContext<T>): Promise<any>;
  beforeValidate(value: unknown, context: Parameters<FieldHookShared>[1]): Promise<any>;
  /** Resolves `field.defaultValue` — calling it if it's a `DefaultValueFn`,
   *  returning it as-is otherwise. Every field type stores `defaultValue` as
   *  plain data (never a fluent-setter name collision on `.field` itself),
   *  but several concrete builders (Select, Link, Slug, Relation) *do* expose
   *  a `.defaultValue(...)` fluent setter — bare `config.defaultValue` on
   *  those would silently return that setter, not the stored value. */
  defaultValue(context?: { event?: RequestEvent }): unknown;
};

export type ReferentialAction = 'cascade' | 'set null' | 'restrict' | 'no action';

export type FieldReferenceOptions = {
  onDelete?: ReferentialAction;
  onUpdate?: ReferentialAction;
  /** Referenced table is this field's own table (self-FK); adapters need this
   *  to emit a `(): any =>` accessor and avoid a TS circular-declaration error. */
  selfReferencing?: boolean;
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

  localized() {
    this.field.localized = true;
    return this;
  }

  validate(validateFunction: FieldValidationFunc<T>) {
    this.field.validate = validateFunction as FieldValidationFunc<T>;
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
   * Force the field to be on the root table — usefull for fields that
   * should not be versioned (ex: _parent for nested structures should
   * always be on the root table to prevent different versions from having
   * different parents).
   */
  _root() {
    this.field._root = true;
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
      root: !!this.field._root,
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
      defaultValue: (context: { event?: RequestEvent } = {}): unknown => {
        const value = this.field.defaultValue;
        return typeof value === 'function' ? (value as DefaultValueFn<unknown>)(context) : value;
      }
    };
  }

  hint(hint: string) {
    this.field.hint = hint;
    return this;
  }

  clone(): typeof this {
    // Create a new instance of the same class
    const Constructor = this.constructor as new (...args: any[]) => typeof this;
    // Get constructor parameters from the current instance
    const name = this.field.name;
    const type = this.field.type;
    // Create a new instance
    const clone = new Constructor(name, type);
    // Deep clone the field object to avoid reference issues
    clone.field = cloneDeep(this.field);

    return clone;
  }

  /** Server-side schema concern, same family as $beforeRead/$beforeSave. */
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
}
