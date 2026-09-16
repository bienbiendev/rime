import type {
  FieldBuilder,
  FieldNode,
  ValueNode
} from '$lib/core/fields/builders/field-builder.js';
import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import type { WithoutBuilders } from '$lib/core/fields/types.js';
import type { GenericBlock } from '$lib/core/prototype/types.js';
import type { Field, FormField } from '$lib/fields/types.js';
import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
import { toPascalCase, joinMemberTypes } from '$lib/util/string.js';
import type { Dic } from '$lib/util/types.js';
import type { IconProps } from '@lucide/svelte';
import dedent from 'dedent';
import type { Component, Snippet } from 'svelte';
import { number } from '../number/index.js';
import { text } from '../text/index.js';
import Blocks from './component/Blocks.svelte';
import Cell from './component/Cell.svelte';

export const blocks = (name: string, blocks: BlockBuilder[]) => new BlocksBuilder(name, blocks);

export const block = (name: string) => new BlockBuilder(name);

export class BlocksBuilder extends FormFieldBuilder<BlocksField> {
  constructor(name: string, blocks: BlockBuilder[]) {
    super(name, 'blocks');
    this.field.blocks = blocks;
    this.field.defaultValue = [];
    this.field.isEmpty = (value) => {
      return !value || (Array.isArray(value) && value.length === 0);
    };
  }

  get component() {
    return Blocks;
  }
  get cell() {
    return Cell;
  }

  /**
   * One row in the document form, `3 blocks · Edit`, with the blocks edited in focus mode.
   * For a layout field, in place of the list of cards.
   */
  summary() {
    this.field.summary = true;
    return this;
  }

  localized() {
    if (this.field.blocks.length === 0) {
      throw new Error('localized() must be called after blocks assignment');
    }
    this.field.localized = true;

    // Set all descendant fields localized
    this.field.blocks = this.field.blocks.map((blockBuilder) => {
      // Add a locale prop in each block
      const hasAlreadyLocale = blockBuilder.block.fields.some((field) => field.name === 'locale');
      if (!hasAlreadyLocale) {
        blockBuilder.block.fields.push(text('locale').hidden());
      }
      // In each block process fields
      blockBuilder.block.fields = blockBuilder.block.fields.map((field) => {
        // A block's own members are not content: type, position, path and locale stay as they are.
        if (['position', 'type', 'path', 'locale'].includes(field.name)) {
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

      return blockBuilder;
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
        const fieldsType = joinMemberTypes(block.get.fields.map((f) => f.use.generateType()));

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

/**
 * Checks if a field is a blocks field.
 */
export const isBlocksField = (field: Field): field is BlocksField => field.type === 'blocks';

/**
 * Checks if a field is a blocks field (raw type).
 */
export const isBlocksFieldRaw = (field: Field): field is BlocksFieldRaw => field.type === 'blocks';

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
   * import { Home } from '@lucide/svelte'
   * block('home').icon(Home)
   */
  icon(component: Component<IconProps>) {
    this.block.icon = component;
    return this;
  }
  image(url: string) {
    this.block.image = url;
    return this;
  }
  renderTitle(render: BlocksFieldBlockRenderTitle) {
    this.block.renderTitle = render;
    return this;
  }
  /**
   * The component drawn for the block on the stage of focus mode.
   * It gets the block value, its path, its fields and the form, so it can show the value,
   * resolve its relations with `populate` and mount panel fields with `RenderFields`.
   * @example
   * block('hero').fields(text('title'), richText('text')).render(HeroRender)
   */
  render(component: Component<BlockRenderProps>) {
    this.block.render = component;
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
  tree?: boolean;
  /** Rendered as one row in the form; the blocks are edited in focus mode. */
  summary?: boolean;
  blocks: BlockBuilder[];
};

export type BlocksFieldBlockRenderTitle = (args: { values: Dic; position: number }) => string;

/** What a block's render component receives. */
export type BlockRenderProps = {
  /** The block value, relations as `{ relationTo, documentId }`. */
  block: GenericBlock;
  /** `layout.sections.0` */
  path: string;
  /** The block's field builders, for `RenderFields`. */
  fields: FieldBuilder<Field>[];
  form: DocumentFormContext;
  /** The block's nested lists, each block in its own selectable wrapper. `children('items')` for one list. */
  children?: Snippet<[name?: string]>;
};

export type BlocksFieldBlock = {
  name: string;
  label?: string;
  description?: string;
  image?: string;
  icon?: Component<IconProps>;
  renderTitle?: BlocksFieldBlockRenderTitle;
  render?: Component<BlockRenderProps>;
  fields: FieldBuilder<Field>[];
};

export type BlocksFieldRaw = FormField & {
  type: 'blocks';
  tree?: boolean;
  summary?: boolean;
  blocks: WithoutBuilders<BlocksFieldBlock>[];
};
