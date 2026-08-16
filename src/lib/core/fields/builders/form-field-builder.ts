import type { FieldPanelTableConfig } from '$lib/types.js';
import { capitalize } from '$lib/util/string.js';
import type { Dic } from '$lib/util/types.js';
import cloneDeep from 'clone-deep';
import type {
  FieldAccess,
  FieldHook,
  FieldHookClient,
  FieldHookContext,
  FieldHookShared,
  FieldValidationFunc,
  FieldWidth,
  FormField
} from '../../../fields/types.js';
import { FieldBuilder } from './field-builder.js';

/** Adapter-agnostic storage primitive — column syntax only, not default-value semantics. */
export type DataType = 'text' | 'boolean' | 'number' | 'timestamp' | 'json';

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
  /** Every concrete leaf field builder is expected to implement a
   *  `get dataType(): DataType` accessor (see e.g. `$lib/fields/text/index.ts`).
   *  Not declared here — TS doesn't allow `declare` on accessors in this
   *  project's config, and a plain base field would conflict with subclasses
   *  that need a computed getter (e.g. `select`, whose dataType depends on
   *  `many`). Container builders (Group/Tabs/Blocks/Tree) never get asked,
   *  since the adapter's tree-walker special-cases them before reaching the
   *  generic column-rendering branch; `column.server.ts` reads `.dataType`
   *  via a narrow cast for the same reason it already casts `unique`. */
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

  get __label(): string {
    return this.field.label || capitalize(this.field.name);
  }

  hidden() {
    this.field.hidden = true;
    return this;
  }

  localized() {
    this.field.localized = true;
    return this;
  }

  override get __localized(): boolean {
    return !!this.field.localized;
  }

  validate(validateFunction: FieldValidationFunc<T>) {
    this.field.validate = validateFunction as FieldValidationFunc<T>;
    return this;
  }

  __validate(value: unknown, context: Parameters<FieldValidationFunc<T>>[1]): true | string {
    if (this.field.validate) {
      return this.field.validate(value, { ...context, config: this.field });
    }
    return true;
  }

  condition(conditionFunction: (doc: Dic, siblings: Dic) => boolean) {
    this.field.condition = conditionFunction;
    return this;
  }

  __condition(doc: Dic, siblings: Dic): boolean {
    if (this.field.condition) {
      try {
        return this.field.condition(doc, siblings);
      } catch (err: any) {
        console.error(err.message);
        return false;
      }
    }
    return true;
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

  get __required(): boolean {
    return !!this.field.required;
  }

  get __defaultValue() {
    return this.field.defaultValue;
  }

  /** `isEmpty` is a per-field-type predicate *function* stored as plain data
   *  (set in this constructor, overridden by some leaf fields), not a fluent
   *  setter — there's no name collision here, just no method wrapping it
   *  yet. Exposed as a method for the same reason as __root/__localized:
   *  callers shouldn't need `.raw.isEmpty(value)` to invoke it. */
  __isEmpty(value: unknown): boolean {
    return this.field.isEmpty(value);
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

  override get __root(): boolean {
    return !!this.field._root;
  }

  access(access: { create?: FieldAccess; read?: FieldAccess; update?: FieldAccess }) {
    this.field.access = { ...this.field.access, ...access };
    return this;
  }

  __canRead(...args: Parameters<FieldAccess>): boolean {
    return !!this.field.access?.read?.(...args);
  }

  __canCreate(...args: Parameters<FieldAccess>): boolean {
    return !!this.field.access?.create?.(...args);
  }

  __canUpdate(...args: Parameters<FieldAccess>): boolean {
    return !!this.field.access?.update?.(...args);
  }

  onChange(hook: FieldHookClient) {
    this.field.hooks!.onChange ??= [];
    this.field.hooks!.onChange.push(hook);
    return this;
  }

  __onChange(value: unknown, context: Parameters<FieldHookClient>[1]): void {
    for (const hook of this.field.hooks?.onChange ?? []) {
      hook(value, context);
    }
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

  async $__beforeRead(value: unknown, context: Omit<FieldHookContext<T>, 'config'>): Promise<any> {
    let result = value;
    for (const hook of this.field.hooks?.beforeRead ?? []) {
      result = await hook(result, { ...context, config: this.field });
    }
    return result;
  }

  $beforeSave(hook: FieldHook<T>) {
    this.field.hooks!.beforeSave ??= [];
    this.field.hooks!.beforeSave.push(hook);
    return this;
  }

  async $__beforeSave(value: unknown, context: FieldHookContext<T>): Promise<any> {
    let result = value;
    for (const hook of this.field.hooks?.beforeSave ?? []) {
      result = await hook(result, { ...context, config: this.field });
    }
    return result;
  }

  beforeValidate(hook: FieldHookShared) {
    this.field.hooks!.beforeValidate ??= [];
    this.field.hooks!.beforeValidate.push(hook);
    return this;
  }

  async __beforeValidate(value: unknown, context: Parameters<FieldHookShared>[1]): Promise<any> {
    let result = value;
    for (const hook of this.field.hooks?.beforeValidate ?? []) {
      result = await hook(result, { ...context, config: this.field });
    }
    return result;
  }
}
