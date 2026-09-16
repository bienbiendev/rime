import {
  FieldBuilder,
  type FieldNode,
  type NodeStorage,
  type ValueNode
} from '$lib/core/fields/builders/field-builder.js';
import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import type { Field, FormField } from '$lib/fields/types.js';
import { joinMemberTypes, toPascalCase } from '$lib/util/string.js';
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
    const hasAlreadyLocale = this.field.fields.some((field) => field.name === 'locale');
    if (!hasAlreadyLocale) {
      this.field.fields.push(text('locale').hidden());
    }
    // Set all descendant fields localized
    this.field.fields = this.field.fields.map((field) => {
      // A row's own members are not content: position, path and locale stay as they are.
      if (['position', 'path', 'locale'].includes(field.name)) {
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
    const fieldsType = joinMemberTypes(this.get.fields.map((f) => f.use.generateType()));
    const treeType = dedent`
    //@shared:start ${blockTypeName}
     export type ${blockTypeName} = {
        id: string;
        ${fieldsType};
	      _children: ${blockTypeName}[]
    }
    //@shared:end`;
    return `${treeType}\n\n${this.name}: Array<${blockTypeName}>,`;
  }

  /** One branch, nesting into itself through `_children`, in a table of its own. */
  protected override nodes(): FieldNode[] {
    return [
      { segment: '#', repeatVia: '_children', fields: this.field.fields, storage: this.storage }
    ];
  }

  private get storage(): NodeStorage {
    return { kind: 'tree', name: this.name };
  }

  /**
   * The rows a value has, the nesting flattened into the segment.
   *
   * ```
   * [{ label: 'a', _children: [{ label: 'b' }] }]  ->  0  ·  0._children.0
   * ```
   */
  protected override nodesFor(value: unknown): ValueNode[] {
    const nodes: ValueNode[] = [];
    const walk = (items: unknown, prefix: string) => {
      if (!Array.isArray(items)) return;
      items.forEach((item, index) => {
        const segment = prefix ? `${prefix}._children.${index}` : `${index}`;
        nodes.push({ segment, fields: this.field.fields, storage: this.storage, value: item });
        walk(item?._children, segment);
      });
    };
    walk(value, '');
    return nodes;
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
