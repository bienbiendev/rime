import type {
  FieldBuilder,
  FieldNode,
  ValueNode
} from '#lib/core/fields/builders/field-builder.js';
import {
  FormFieldBuilder,
  type FormFieldUse
} from '#lib/core/fields/builders/form-field-builder.js';
import type { CompletesDefault } from '#lib/core/fields/complete.js';
import type { WithoutBuilders } from '#lib/core/fields/types.js';
import type { GenericBlock } from '#lib/core/prototype/types.js';
import { RimeFormError } from '#lib/core/errors/index.js';
import type {
  DefaultOptions,
  DefaultValueFn,
  Field,
  FieldValidationFunc,
  FormField
} from '#lib/fields/types.js';
import type { DocumentFormContext } from '#lib/panel/context/documentForm.svelte.js';
import { toPascalCase, joinMemberTypes } from '#lib/util/string.js';
import type { Dic } from '#lib/util/types.js';
import type { IconProps } from '@lucide/svelte';
import type { RequestEvent } from '@sveltejs/kit';
import dedent from 'dedent';
import type { Component, Snippet } from 'svelte';
import { number } from '../number/index.js';
import { text } from '../text/index.js';
import Blocks from './component/Blocks.svelte';
import Cell from './component/Cell.svelte';
import { isEmptyList, localizeRepeatableFields } from '../repeatable.js';
import { completeBlocks, type BlockDefault } from './defaults.js';

export const blocks = (name: string, blocks: BlockBuilder[]) => new BlocksBuilder(name, blocks);

/** Each item names a block type of the list: another type has no table to be stored in. */
const ensureDeclaredTypes: FieldValidationFunc<BlocksField> = (value, { config }) => {
  if (!Array.isArray(value)) return true;
  const declared = config.blocks.map((block) => block.name);
  return value.every((item) => declared.includes(item?.type)) || RimeFormError.UNKNOWN_BLOCK;
};

export const block = (name: string) => new BlockBuilder(name);

export class BlocksBuilder extends FormFieldBuilder<BlocksField> {
  constructor(name: string, blocks: BlockBuilder[]) {
    super(name, 'blocks');
    this.field.blocks = blocks;
    this.field.defaultValue = [];
    this.field.isEmpty = isEmptyList;
    this.field.validate = ensureDeclaredTypes;
  }

  get component() {
    return Blocks;
  }
  get cell() {
    return Cell;
  }

  /**
   * `default`: the list of cards in the document form.
   * `summary`: one row, `3 blocks · Edit`, with the blocks edited in focus mode.
   */
  layout(layout: 'default' | 'summary') {
    this.field.layout = layout;
    return this;
  }

  /**
   * The blocks a new document starts with. When this list sits inside a block, a block inserted in
   * the panel starts with them too. Each names its `type` and the values it starts with; the rest
   * comes from its fields.
   *
   * ```ts
   * blocks('sections', [paragraph, grid]).defaultValue([
   *   { type: 'grid', title: 'Gallery', items: [{ type: 'paragraph' }] }
   * ]);
   * ```
   */
  defaultValue(value: BlockDefault[] | DefaultValueFn<BlockDefault[]>, options?: DefaultOptions) {
    this.field.defaultValue = value;
    this.field.defaultFill = options?.fill;
    return this;
  }

  /** The default completed as a document holds it — see `completeBlocks`. */
  override get use(): FormFieldUse<BlocksField> & CompletesDefault<BlockDefault> {
    const use = super.use;
    const completeDefault = (value: BlockDefault[]) =>
      completeBlocks(this.name, this.field.blocks, value);
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
   * The list and its blocks' content fields, localized. The list gets its own copies of its block
   * types: a block shared with another list stays as it is.
   */
  localized() {
    if (this.field.blocks.length === 0) {
      throw new Error('localized() needs at least one block type');
    }
    this.field.localized = true;

    // A block's own members are not content: type, position, path and locale stay as they are
    this.field.blocks = this.field.blocks.map((blockBuilder) => {
      const copy = blockBuilder.clone();
      copy.block.fields = localizeRepeatableFields(blockBuilder.block.fields, [
        'position',
        'type',
        'path',
        'locale'
      ]);
      return copy;
    });

    return this;
  }

  override compile() {
    return {
      ...this.field,
      blocks: this.field.blocks.map((block) => {
        return block.compile();
      }),
      component: this.component,
      cell: this.cell || undefined
    } as any;
  }

  protected override generateType(): string {
    const blockNames: string[] = [];

    const blocksTypes = this.field.blocks
      .map((block) => {
        const blockTypeName = `Block${toPascalCase(block.name)}`;
        blockNames.push(blockTypeName);
        // The template below writes `type` as the block's name, so its hidden field stays out.
        const fields = block.get.fields.filter((f) => f.name !== 'type');
        const fieldsType = joinMemberTypes(fields.map((f) => f.use.generateType()));

        return dedent`
        //@shared:start ${blockTypeName}
        export type ${blockTypeName} = {
          id: string
          type: '${block.name}'
          ${fieldsType}
        }
        //@shared:end`;
      })
      .join('\n');

    return `${blocksTypes}\n\n${this.name}: Array<${blockNames.join(' | ')}>,`;
  }

  /** One branch per block type, at an index only a document can name, each a table of its own. */
  protected override nodes(): FieldNode[] {
    return this.field.blocks.map((block) => ({
      segment: `#:${block.name}`,
      fields: block.get.fields,
      storage: { kind: 'blocks', name: block.name }
    }));
  }

  protected override nodesFor(value: unknown): ValueNode[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item, index) => {
      const block = this.field.blocks.find((candidate) => candidate.name === item?.type);
      // Residual data for a block type the config no longer declares.
      if (!block) return [];
      return [
        {
          segment: `${index}:${block.name}`,
          fields: block.get.fields,
          storage: { kind: 'blocks', name: block.name },
          value: item
        }
      ];
    });
  }
}

export class BlockBuilder {
  block: BlocksFieldBlock;

  constructor(name: string) {
    this.block = {
      name,
      fields: [text('type').hidden(), text('path').hidden(), number('position').hidden()]
    };
  }
  /**
   * Sets the icon, must be a @lucide/svelte component
   * @example
   * import Home from '@lucide/svelte/icons/home'
   * block('home').icon(Home)
   */
  icon(component: Component<IconProps>) {
    this.block.icon = component;
    return this;
  }
  /**
   * The block's picture in the pickers of types to add: a component drawing an `<svg>`, which
   * fills a 16:10 frame. It draws with `currentColor`, so it follows the light and dark themes.
   * Without one, the pickers show the icon.
   * @example
   * import HeroThumbnail from './thumbnails/Hero.svelte'
   * block('hero').thumbnail(HeroThumbnail)
   */
  thumbnail(component: Component) {
    this.block.thumbnail = component;
    return this;
  }
  renderTitle(render: BlocksFieldBlockRenderTitle) {
    this.block.renderTitle = render;
    return this;
  }
  /**
   * The component drawn for the block on the stage of focus mode.
   * It gets the block value, its path, its fields, the form and the locale the document is edited
   * in, so it can show the value, read its relations in that locale with
   * `Relation.resolve(block.image, { locale })` and mount panel fields with `RenderFields`.
   *
   * `controls: false` drops the bar above the selected block, for a small one like a button.
   * Keys, ⌘K and the layers still move, duplicate and remove it.
   * @example
   * block('hero').fields(text('title'), richText('text')).render(HeroRender)
   * block('button').render(ButtonRender, { controls: false })
   */
  render(component: Component<BlockRenderProps>, options: { controls?: boolean } = {}) {
    this.block.render = component;
    if (options.controls === false) this.block.controls = false;
    return this;
  }
  description(description: string) {
    this.block.description = description;
    return this;
  }
  label(label: string) {
    this.block.label = label;
    return this;
  }
  fields(...fields: FieldBuilder<Field>[]) {
    this.block.fields = [...fields, ...this.block.fields];
    return this;
  }

  /** A copy with its own list of fields: the fields themselves are shared. */
  clone() {
    const copy = new BlockBuilder(this.block.name);
    copy.block = { ...this.block, fields: [...this.block.fields] };
    return copy;
  }

  get get() {
    return { ...this.block };
  }

  get name() {
    return this.block.name;
  }

  compile(): WithoutBuilders<BlocksFieldBlock> {
    return { ...this.block, fields: this.block.fields.map((f) => f.compile()) };
  }
}

/****************************************************/
/* Types
/****************************************************/
export type BlocksField = FormField & {
  type: 'blocks';
  /** `summary`: one row in the form, the blocks edited in focus mode. */
  layout?: 'default' | 'summary';
  blocks: BlockBuilder[];
};

export type BlocksFieldBlockRenderTitle = (args: { values: Dic; position: number }) => string;

/** What a block's render component receives. */
export type BlockRenderProps = {
  /** The block value; read a relation with `Relation.resolve(block.image, { locale }).first()`. */
  block: GenericBlock;
  /** `layout.sections.0` */
  path: string;
  /** The block's field builders, for `RenderFields`. */
  fields: FieldBuilder<Field>[];
  form: DocumentFormContext;
  /** The locale the document is edited in, `undefined` without localization. */
  locale: string | undefined;
  /**
   * The block's nested lists. Each list is a `.rz-renders`, each block in it a selectable
   * `.rz-renders__item`, and a `+` follows them, `.rz-renders__add`. `children('items')` draws one
   * list; `class` names its `.rz-renders`, for the render to lay it out.
   * @example
   * {@render children?.('items', { class: 'cards' })}
   *
   * :global(.cards) { display: flex; gap: 1rem; }
   * :global(.cards > .rz-renders__add) { align-self: center; }
   */
  children?: Snippet<[name?: string, options?: { class?: string }]>;
};

export type BlocksFieldBlock = {
  name: string;
  label?: string;
  description?: string;
  icon?: Component<IconProps>;
  thumbnail?: Component;
  renderTitle?: BlocksFieldBlockRenderTitle;
  render?: Component<BlockRenderProps>;
  /** `false`: no bar above the block when it is selected on the stage. */
  controls?: boolean;
  fields: FieldBuilder<Field>[];
};
