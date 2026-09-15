---
'rimecms': minor
---

Added: every collection and area config carries `blank()`, a document of its own shape with every
default applied. It replaces the `createBlankDocument(config)` function and works on both halves,
so the panel builds a blank document from the config it already holds.

```ts
const page = config.getCollection('pages').blank();
```

A field builds its own share of it: `blank()` on the builder answers with the members that field
owns, so a group nests, tabs spread one member per tab, and a presentational field contributes
nothing.
