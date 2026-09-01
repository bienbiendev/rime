import { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import type { Field, FormField } from '$lib/fields/types.js';
import { toPascalCase } from '$lib/util/string.js';
import type { Dic } from '$lib/util/types.js';
import dedent from 'dedent';
import { number } from '../number/index.js';
import { text } from '../text/index.js';
import Cell from './component/Cell.svelte';
import Tree from './component/Tree.svelte';

export const tree = (name: string) => new TreeBuilder(name);

export class TreeBuilder extends FormFieldBuilder<TreeField> {
  constructor(name: string) {
    super(name, 'tree');
    this.field.defaultValue = [];
    this.field.isEmpty = (value) => !value || (Array.isArray(value) && value.length === 0);

    this.field.fields = [text('path').hidden(), number('position').hidden()];
    this.field.maxDepth = 8;
    this.field.addItemLabel = 'Add an item';
  }

  get component() {
    return Tree;
  }
  get cell() {
    return Cell;
  }

  fields(...fields: FieldBuilder<Field>[]) {
    this.field.fields = [...(this.field.fields || []), ...fields];
    return this;
  }

  addItemLabel(label: string) {
    this.field.addItemLabel = label;
    return this;
  }

  renderTitle(render: TreeFieldBlockRenderTitle) {
    this.field.renderTitle = render;
    return this;
  }

  maxDepth(n: number) {
    this.field.maxDepth = n;
    return this;
  }

  localized() {
    if (this.field.fields.length === 0) {
      throw new Error('localized() must be called after fields assignment');
    }
    this.field.localized = true;

    // Add a locale prop in its fields
    const hasAlreadyLocale = !!this.field.fields
      .filter((field) => field instanceof FormFieldBuilder)
      .find((field) => field.name === 'locale');
    if (!hasAlreadyLocale) {
      this.field.fields.push(text('locale').hidden());
    }
    // Set all descendant fields localized
    this.field.fields = this.field.fields.map((field) => {
      // If it's a "position" or "path" field do not set as localized
      // as it's a treeBlock property
      if (
        field instanceof FormFieldBuilder &&
        ['position', 'path', 'locale'].includes(field.name)
      ) {
        return field;
      }
      // For all others fields set as localized
      if ('localized' in field && field instanceof FormFieldBuilder) {
        // Clone to prevent localizing a field used elsewhere
        const fieldClone = field.clone();
        fieldClone.localized();
        return fieldClone;
      }
      return field;
    });
    return this;
  }

  compile() {
    return {
      ...this.field,
      fields: this.field.fields.map((f) => f.compile())
    };
  }

  protected override generateType(): string {
    const blockTypeName = `Tree${toPascalCase(this.name)}`;
    const fieldsType = this.get.fields.map((f) => f.use.generateType()).join(',\n');
    const treeType = dedent`
    /** @dedupe-start ${blockTypeName} **
     export type ${blockTypeName} = {
        id: string;
        ${fieldsType};
	      _children: ${blockTypeName}[]
    } ** @dedupe-end */`;
    return `${treeType}\n\n${this.name}: Array<${blockTypeName}>,`;
  }
}

/**
 * Checks if a field is a tree field.
 */
export const isTreeFieldRaw = (field: Field): field is TreeFieldRaw => field.type === 'tree';

/****************************************************/
/* Types
/****************************************************/

export type TreeField = FormField & {
  type: 'tree';
  maxDepth: number;
  renderTitle?: TreeFieldBlockRenderTitle;
  fields: FieldBuilder<Field>[];
  addItemLabel: string;
};

export type TreeFieldBlockRenderTitle = (args: { position: string; values: Dic }) => string;

export type TreeFieldRaw = FormField & Omit<TreeField, 'fields'> & { fields: Field[] };
