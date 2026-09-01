# Adapter schema gen

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

- currently drizzle table declaration is a cameCase mix
- sqlite ends to snake case.

## Vocabulary

Thinking of a consilidated pattern :

All table name are snake case.

**base**: `snakeCase(slug)`
ex: `pages`

**shadow**: ex a `version` table : {owner}__{shadow} (**added double underscore** __ means shadow of)
ex: `pages__versions`

a shadow can only shadow a base.

**child**: a table as has a junction to a base or a shadow __$ means child from

- `pages__$blocks_hero` (blocks fields)
- `pages__$relations` (relations fields) always wired to base or shadow, created when a relation exist in the fields tree
- `pages__$tree` (tree fields)

a child can only has base or shadow parent.

**branch**, ex: a `locales` table : {owner}{BranchName}

- `pages__versions--Locales`
- `pages--locales`
- `pages__$blocks_hero--locales`
- `pages__versions__$blocks_hero--locales`

The locales branch is not an external feature, it is built with the adapter.
But the naming `branch` mean :

- with a branch the owner may be split into two tables : {child} {child}--{branch}

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

## Drizzle Relations

Let's update to drizzle-orm@rc to handle the next 1.0 relation API.
Let's sse how to implement then relation definition. It is simpler so the where and with may be easier to implement.
