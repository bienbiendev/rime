import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import type { DefaultValueFn, FieldValidationFunc, FormField, Option } from '$lib/fields/types.js';
import { capitalize } from '$lib/util/string.js';

const ensureSelectIsOption: FieldValidationFunc<FieldWithOptions> = (value, { config }) => {
	const selected = value;
	const validValues = config.options.map((o) => o.value);
	if (selected && Array.isArray(selected)) {
		for (const value of selected) {
			if (!validValues.includes(value)) {
				return `Value should be one of these : ${validValues.join('|')}`;
			}
		}
	} else if (typeof selected === 'string') {
		if (!validValues.includes(selected)) {
			return `Value should be one of these : ${validValues.join('|')}`;
		}
	}
	return true;
};

type FieldWithOptions = FormField & {
	options: Option[];
	defaultValue?: (string | DefaultValueFn<string>) | (string[] | DefaultValueFn<string[]>);
	many?: boolean;
};

class PickFieldBuilder<T extends FieldWithOptions = FieldWithOptions> extends FormFieldBuilder<T> {
	constructor(name: string, type: string) {
		super(name, type);
		this.field.validate = ensureSelectIsOption;
	}

	options(...options: (Option | string)[]) {
		this.field.options = options.map((option) => {
			if (typeof option === 'string') {
				return { label: capitalize(option), value: option };
			} else {
				const hasNoLabel = !('label' in option);
				if (hasNoLabel) {
					return {
						value: option.value,
						label: capitalize(option.value)
					};
				}
			}
			return option;
		});

		return this;
	}

	compile() {
		if (!this.field.options || !this.field.options.length) {
			throw new Error(`${this.field.name} should at least have one option`);
		}
		if (!this.field.isEmpty) {
			if (this.field.many) {
				this.field.isEmpty = (value) => Array.isArray(value) && value.length === 0;
			} else {
				this.field.isEmpty = (value) => !value;
			}
		}
		return super.compile();
	}
}

export class PickOneFieldBuilder<
	T extends FieldWithOptions = FieldWithOptions
> extends PickFieldBuilder<T> {
	defaultValue(value: string | DefaultValueFn<string>) {
		this.field.defaultValue = value;
		return this;
	}
}

export class PickManyFieldBuilder<
	T extends FieldWithOptions = FieldWithOptions
> extends PickFieldBuilder<T> {
	defaultValue(value: string[] | DefaultValueFn<string[]>) {
		this.field.defaultValue = value;
		return this;
	}

	many() {
		this.field.many = true;
		return this;
	}
}
