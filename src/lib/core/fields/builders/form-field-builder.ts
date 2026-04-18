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

type GenerateSchemaFn = (args: { camel: string; snake: string; suffix: string }) => string;

export class FormFieldBuilder<T extends FormField> extends FieldBuilder<T> {
  _generateSchema: null | GenerateSchemaFn = null;

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

  $generateSchema(fn: GenerateSchemaFn) {
    this._generateSchema = fn;
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
