# Decouple Fields type from parsing logic

Currently fieldbuilder instance type is the way for parser to determine actions, ex :

```ts
if (fieldConfig instanceof RelationFieldBuilder) {
  // do something
} else if (fieldConfig instanceof BlocksBuilder) {
  // do something else
}
```

The idea is to provide fields a get nodes that points the list of fields.
With this coupled with get fields, the parser can iterate over the fields and build the path without knowing the field type.

Example problematic fields and their respective data structure :

```ts
// tabs

type TabsField = {
  name: '', // <- PIA not considered as formField but hold data
  // An idea
  get nodes: () => ({
    buildPath: (parent, node, n) => `${parent === '' ? '' : `${parent}.` }${node.name}`
    nodes: Tab[] // return this.tabs
  }),
  //
  tabs: {
    name: string;
    label: string;
    fields: FieldBuilder[];
    live: true;
  }[];
};

// Data is
{
  tabName : { fieldName: 'baz', fieldText: 'foo', something: 'bar' },
  otherTabName : { someotherfield: 'baz' },
  anOtherTabName : { otherfield: 'booz' },
}

type BlocksField = {
  name: string
  type: 'blocks';
  // An idea
  get nodes: () => ({
    buildPath: (parent, node, n) => `${parent === '' ? '' : `${parent}.` }${this.name}.${n}:${node.type}`
    list: Block[] // this.blocks
  }),
  //
  blocks: {
    name: string;
    label?: string;
    description?: string;
    image?: string;
    icon?: Component<IconProps>;
    renderTitle?: BlocksFieldBlockRenderTitle;
    fields: FieldBuilder<Field>[];
  }[];
};

// Data is
{
  //...
  blocksField : [
    { type: 'blockType', fieldText: 'foo', something: 'bar' },
    { type: 'blockType', fieldText: 'foo', something: 'bar' }
  ]
}

type TreeField = {
  name: string
  type: 'tree';
  // An idea
  get nodes: () => ({
    buildPath: (node, n) => `${this.name}`
    list: FieldsBuilder[] // this.fields
  })
  //
  maxDepth: number;
  renderTitle?: TreeFieldBlockRenderTitle;
  fields: FieldBuilder<Field>[];
  addItemLabel: string;
};

// data is
{
  treeField : [{ fieldText: 'foo', something: 'bar' }]
}

export type GroupField = {
  type: 'group';
  name: string;
  label?: string;
  fields: FieldBuilder<Field>[];
  preview?: Component<FieldsPreviewProps>;
};

// data is
{
  groupField : { fieldText: 'foo', something: 'bar', other: 'baz' }
}
```

Ideas :

- add a get nodes on the builder when no direct fields is present.
- a path contribution function, hard to say how this could be implemented.
- a value getter on real data ?

Ex rewrite of findThumbnailField easiest :

```ts
export function findThumbnailField(
  fields: FieldBuilder<Field>[] = [],
  basePath: string = ''
): ThumbnailFieldResult | null {
  const buildPath = (parent, part) => (parent ? `${parent}.${part}` : part);

  for (const field of fields) {
    // Direct check for isThumbnail
    if ('isThumbnail' in field.get && field.get.isThumbnail === true) {
      const path = buildPath(basePath, field.name);
      return { field, path };
    }

    if (field.get.fields) {
      const path = buildPath(basePath, field.name);
      const found = findThumbnailField(field.get.fields, path);
      if (found) return found;
    }

    if (field.get.nodes) {
      for (const node of field.get.nodes) {
        const path = buildPath(basePath, node.name);
        return findThumbnailField(node.get.fields, path);
      }
    }
  }

  return null;
}
```

Rewrite of buildTreeblockTypes: not been rewrote, all has been moved into each field type generation.

> IMPORTANT type generation should be handled by the field itself with depupe comments
> Then add a dedupe function to the whole type file.

```ts
export class TreeBuilder extends FormFieldBuilder<TreeField> {
  //...
  protected override generateType(): string {
    const blockTypeName = `Tree${toPascalCase(this.name)}`;
    const treeType = detent`
    /** @dedupe start ${blockTypeName} **/
    type ${blockTypeName} = ${this.get.fields.map((f) => f.generateType()).join(',\n')}
    /** @dedupe end **/
    `;
    return `${this.name}: Array<${blockTypeName}>,`;
  }
}
```

## How to proceed :

- list all place where a field type conditional is used in the codebase.
- in each place status if a get.nodes would be enough to replace the conditional.
- in each place tell how path a created on the fly and if a buildPath function would be enough to replace the conditional.
- create a precise plan to decouple fields type from parsers.

For the plan creation, use a lot of code blocks examples to illustrate the idea and the solution. For path handling, nodes handling,...
One of a hard place to consider is the config-map building.
