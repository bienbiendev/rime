---
'rimecms': minor
---

Added: `RelationInline` from `rimecms/panel` lets a block render pick its images in place. It wraps what the render draws for a relation to an upload collection: while empty it draws a _Choose an image_ button, once picked it hands the docs to the render's `children` snippet, and on the selected block it shows _Replace_ and _Remove_, or _Edit the selection_ for a many relation, which open the upload picker. It writes the same field the inspector shows.

```svelte
<RelationInline path="{path}.image" config={image} {form}>
  {#snippet children({ docs })}
    <img src={docs[0].sizes.md} alt={docs[0].alt} />
  {/snippet}
</RelationInline>
```
