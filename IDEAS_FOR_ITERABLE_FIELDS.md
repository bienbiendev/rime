```ts
interface IFieldPart {
  type?: string;
  name?: string;
  // Simple recursion: Group, Tree — one list of children
  fields?: IFieldPart[];
  // Named variants: Blocks' block types, Tabs' tabs — each variant is its
  // own named sub-tree, not just a flat list of fields
  content?: { name: string; fields: IFieldPart[] }[];
}
```

- `fields` vs `content` split on: does this container have ONE child tree, or
  SEVERAL NAMED ones? Group/Tree -> `fields`. Blocks/Tabs -> `content`.
- Every builder would need a `.toFieldPart()`, and every `instanceof
BlocksBuilder / TabsBuilder / GroupFieldBuilder / TreeBuilder` traversal
  (util.ts, configMap/index.ts, root.server.ts, find-title.ts,
  find-thumbnail.ts, validate.server.ts, dev/generate/types, doc.ts, ...)
  would switch to walking this instead of their own `__fields`/`__blocks`/
  `__tabs`.
- Third parallel shape (builder / raw / IFieldPart) to keep in sync —
  worth it only if it actually replaces the instanceof chains everywhere,
  not just adds a new one.
- Do as its own deliberate pass, not bolted onto other work.

## What about :

```ts
interface IFieldPart {
  type?: string;
  name?: string;
  fields?: FieldBuilder[]; // Always fields inside
  content?: IFieldPart[];
}
```
