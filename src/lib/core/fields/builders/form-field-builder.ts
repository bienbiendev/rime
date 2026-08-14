import type { FieldPanelTableConfig } from '$lib/types.js';
import type { Dic } from '$lib/util/types.js';
import cloneDeep from 'clone-deep';
import type {
  FieldAccess,
  FieldHook,
  FieldHookClient,
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

export class FormFieldBuilder<T extends FormField> extends FieldBuilder<T> {
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

  get name() {
    return this.field.name;
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
    this.field.validate = validateFunction as FieldValidationFunc<FormField>;
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

  access(access: { create?: FieldAccess; read?: FieldAccess; update?: FieldAccess }) {
    this.field.access = { ...this.field.access, ...access };
    return this;
  }

  onChange(hook: FieldHookClient) {
    this.field.hooks!.onChange ??= [];
    this.field.hooks!.onChange.push(hook);
    return this;
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
