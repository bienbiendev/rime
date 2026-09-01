# Decoupling the adapter from prototypes and features.

Objectif decouple "features" from the adapter.

What's currently here :

base = camelCase(slug) // pages
shadow = base + '_versions' // pages_versions (versions)
directories = stripVersions(base) + '_directories' // pages_directories (upload)

owner = shadow ?? base ← THE load-bearing line

locales = owner + 'Locales' // pages_versionsLocales
block = owner + 'Blocks' + Pascal(block.name) // pages_versionsBlocksHero
tree = owner + 'Tree' + Pascal(field.name) // pages_versionsTreeNav
junction = owner + 'Rels' // pages_versionsRels

Currently drizzle table declaration is a camelCase snakeCase mix. Sqlite naming ends to snake case. We need to consolidate this.

## Vocabulary

Thinking of a consilidated pattern :

All table name and def are snake case.

`export const pages__versions__$blocks_hero__$$locales`

**base**: `snakeCase(slug)`
ex: `pages`

**shadow**: ex a `version` table : {owner}__{shadow} (**added double underscore** __ means shadow of)
ex: `pages__versions`

A shadow can only shadow a base. A shadow get a relation definiton with owner.

**child**: a table as has a junction to a base or a shadow __$ means child from

- `pages__$blocks_hero` (blocks fields)
- `pages__$relations` (relations fields) always wired to base or shadow, created when a relation exist in the fields tree
- `pages__$tree` (tree fields)

A child get a relation definiton with owner
A child can only has base or shadow as parent.

**branch**, ex: a `locales` table : __$$ means a branch from

- `pages__versions__$$locales`
- `pages__$$locales`
- `pages__$blocks_hero__$$locales`
- `pages__versions__$blocks_hero__$$locales`

The `locales` branch may not be an external feature, it could be built with the adapter.
The naming `branch` means : the owner may be split into two tables : {child} {child}__$${branch}

## Adapter facade

With this convetion the adapter doesn't need to provide collection, blocks, relation, area,... facades
It provides something like :

facade('slug') :
-> (has/get)Shadows
-> (has/get)Children
-> (has/get)Banches
-> create
-> read
-> update
-> delete

Then the logic could be something like :
"call update on `pages`"
-> persitence :
pipe provides diff —> facade('pages')->chidlren() -> check branches and decouple data or not.
-> facade('pages')

- has shadow
  - yes —> update its shadow instead of itslef with the reference kep from the base
  - no —> update itslelf
- has branches
  - yes —> decouple tinted data
  - no —> save all to the base or shadow

## Drizzle Relations

Let's update to drizzle-orm@rc to handle the next 1.0 relation API.
Let's sse how to implement then relation definition. It is simpler so the where and with may be easier to implement.

## Blocks, Tree, Relations

Currently the are complety merge into the adapter logic.

- Each of these should hold a mark that says —> create a child from owner
- Provide a way to persistence to detect tinted data ? Currently it is something like if tables includes hard written pattern `{owner}Block{pascal(name)}`

`__{feature}` `__${feature}` `__$${feature}` maybe used to detect features on a current base table.

## Media directories

This is not a shadow, it create a complete new collection, the panel consume it.
It is related to the upload parent by hooks.
Its naming can't be {base}__directories because its a shadow naming so just {base}_directories.
