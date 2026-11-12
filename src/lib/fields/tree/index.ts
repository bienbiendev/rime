import {
  FieldBuilder,
  type FieldNode,
  type NodeStorage,
  type ValueNode
} from '#lib/core/fields/builders/field-builder.js';
import {
  FormFieldBuilder,
  type FormFieldUse
} from '#lib/core/fields/builders/form-field-builder.js';
import type { CompletesDefault } from '#lib/core/fields/complete.js';
import type { DefaultOptions, DefaultValueFn, Field, FormField } from '#lib/fields/types.js';
import { joinMemberTypes, toPascalCase } from '#lib/util/string.js';
import type { Dic } from '#lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import dedent from 'dedent';
import type { Component } from 'svelte';
import { number } from '../number/index.js';
import { text } from '../text/index.js';
import Cell from './component/Cell.svelte';
import Tree from './component/Tree.svelte';
import { isEmptyList, localizeRepeatableFields } from '../repeatable.js';
import { completeTree, type TreeItemDefault } from './defaults.js';

/** A list of items that nest: each item has the fields, and its own items in `_children`. */
export const tree = (name: string) => new TreeBuilder(name);

// A row's own members are not content: position, path and locale stay as they are
const OWN = ['position', 'path', 'locale'];

export class TreeBuilder extends FormFieldBuilder<TreeField> {
  constructor(name: string) {
    super(name, 'tree');
    this.field.defaultValue = [];
    this.field.isEmpty = isEmptyList;

    this.field.fields = [text('path').hidden(), number('position').hidden()];
    this.field.maxDepth = 8;
    this.field.addItemLabel = 'Add an item';
  }

  get component() {
    return Tree;
  }
  get cell(): Component<{ value: any }> {
    return Cell;
  }

  /** The fields of every item. The hidden `path` and `position` stay before them. */
  fields(...fields: FieldBuilder<Field>[]) {
    this.field.fields = [...this.field.fields, ...fields];
    if (this.field.localized) {
      this.field.fields = localizeRepeatableFields(this.field.fields, OWN);
    }
    return this;
  }

  /** The text of the button that adds an item at the root. */
  addItemLabel(label: string) {
    this.field.addItemLabel = label;
    return this;
  }

  /**
   * The title of an item's card: `position` is its place, `1.2` for the second item of the first.
   */
  renderTitle(render: TreeFieldBlockRenderTitle) {
    this.field.renderTitle = render;
    return this;
  }

  /**
   * How many levels may sit under a first-level item: `0` keeps the tree flat, `1` lets a
   * first-level item hold items that hold none. 8 by default.
   */
  maxDepth(n: number) {
    this.field.maxDepth = n;
    return this;
  }

  /**
   * The items a new document starts with. Each names the values it starts with and its own
   * `_children`; the rest comes from the tree's fields.
   *
   * ```ts
   * tree('nav').fields(text('label')).defaultValue([{ label: 'Home', _children: [{ label: 'About' }] }]);
   * ```
   */
  defaultValue(
    value: TreeItemDefault[] | DefaultValueFn<TreeItemDefault[]>,
    options?: DefaultOptions
  ) {
    this.field.defaultValue = value;
    this.field.defaultFill = options?.fill;
    return this;
  }

  /** The default completed as a document holds it — see `completeTree`. */
  override get use(): FormFieldUse<TreeField> & CompletesDefault<TreeItemDefault> {
    const use = super.use;
    const completeDefault = (value: TreeItemDefault[]) => completeTree(this.field.fields, value);
    return {
      ...use,
      completeDefault,
      defaultValue: (context: { event?: RequestEvent } = {}) => {
        const value = use.defaultValue(context);
        return Array.isArray(value) ? completeDefault(value) : [];
      }
    };
  }

  /**
   * The tree and its items' content fields localized, whichever of `fields()` and this comes
   * first. `path`, `position` and `locale` stay as they are.
   */
  localized() {
    this.field.localized = true;
    this.field.fields = localizeRepeatableFields(this.field.fields, OWN);
    return this;
  }

  /** The config as the panel and the server read it, the items' fields compiled too. */
  compile() {
    return {
      ...this.field,
      fields: this.field.fields.map((f) => f.compile())
    };
  }

  /** A shared item type, `TreeNav`, holding its own `_children`, then `nav: Array<TreeNav>`. */
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
