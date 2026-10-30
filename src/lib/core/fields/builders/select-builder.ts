import { RimeFormError } from '#lib/core/errors/index.js';
import type { DataType } from '#lib/core/fields/builders/form-field-builder.js';
import { FormFieldBuilder } from '#lib/core/fields/builders/form-field-builder.js';
import type {
  DefaultOptions,
  DefaultValueFn,
  FieldValidationFunc,
  FormField,
  Option
} from '#lib/fields/types.js';
import { capitalize } from '#lib/util/string.js';

/** A select's value is one of its options, or a list of distinct options when it takes `many`. */
const ensureSelectIsOption: FieldValidationFunc<FieldWithOptions> = (value, { config }) => {
  const allowed = config.options.map((option) => option.value);
  const isOption = (candidate: unknown) =>
    typeof candidate === 'string' && allowed.includes(candidate);
  // Each option once: the panel shows one tag per option, keyed by its value
  const isOptionList = (candidate: unknown) =>
    Array.isArray(candidate) &&
    candidate.every(isOption) &&
    new Set(candidate).size === candidate.length;
  const valid = config.many ? isOptionList(value) : isOption(value);
  return valid || RimeFormError.NOT_AN_OPTION;
};

type FieldWithOptions = FormField & {
  options: Option[];
  defaultValue?: string | string[] | DefaultValueFn<string | string[]>;
  many?: boolean;
  validate?: FieldValidationFunc<FieldWithOptions>;
};

class PickFieldBuilder<T extends FieldWithOptions = FieldWithOptions> extends FormFieldBuilder<T> {
  constructor(name: string, type: string) {
    super(name, type);
    this.field.validate = ensureSelectIsOption;
  }

  /**
   * The options to pick from. A string is its own value, its label capitalized; an object without
   * a label gets one the same way.
   *
   * ```ts
   * select('size').options('small', { value: 'xl', label: 'Extra large' })
   * // [{ value: 'small', label: 'Small' }, { value: 'xl', label: 'Extra large' }]
   * ```
   */
  options(...options: (Option | string)[]) {
    this.field.options = options.map((option) => {
      if (typeof option === 'string') {
        return { label: capitalize(option), value: option };
      } else {
        const hasNoLabel = !('label' in option);
        if (hasNoLabel) {
          return {
            ...option,
            value: option.value,
            label: capitalize(option.value)
          };
        }
      }
      return option;
    });

    return this;
  }

  /** The options as a TypeScript union of string literals: `"a" | "l'été"`. */
  protected optionsType() {
    return this.field.options.map((option) => JSON.stringify(option.value)).join(' | ');
  }
}

/** A field that holds one option: radio, combobox. Stored as text. */
export class PickOneFieldBuilder<
  T extends FieldWithOptions = FieldWithOptions
> extends PickFieldBuilder<T> {
  defaultValue(value: string | DefaultValueFn<string>, options?: DefaultOptions) {
    this.field.defaultValue = value;
    this.field.defaultFill = options?.fill;
    return this;
  }

  get dataType(): DataType {
    return 'text';
  }
}

/** A field that holds one option, or a list of them after `many()`: select. */
export class PickManyFieldBuilder<
  T extends FieldWithOptions = FieldWithOptions
> extends PickFieldBuilder<T> {
  constructor(name: string, type: string) {
    super(name, type);
    // With `many`, a form sends one picked option as a string, and none as ''
    this.beforeValidate((value, { config }) =>
      config.many && typeof value === 'string' ? (value ? [value] : []) : value
    );
  }

  defaultValue(
    value: string | string[] | DefaultValueFn<string | string[]>,
    options?: DefaultOptions
  ) {
    this.field.defaultValue = value;
    this.field.defaultFill = options?.fill;
    return this;
  }

  many() {
    this.field.many = true;
    // A many-select is empty when it holds no option
    this.field.isEmpty = (value) => !Array.isArray(value) || value.length === 0;
    return this;
  }
}
