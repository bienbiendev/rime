# Architecture target

> **Status: mostly landed.** `definePrototype`, `defineFeature` and `definePlugin` all exist;
> `configKey`, `titleFallback`, `singleton`, `features`, `hooks` and `configure` are declared
> members; a feature carries `augment`, `configure`, `shadow`, `handler`, `boot` and `hooks`. The
> adapter speaks base/shadow/child/branch and `adapter.{collection,area}` is gone.
>
> Three things below have **not** landed, and two of them turned out to be wrong:
>
> - **"No `derive`, `augment`, …"** — `augment` stayed, and it is the right primitive: a feature
>   adding fields to a prototype's config is not the same act as one adding a whole collection.
>   `derive` did go: what was `versions.derive` / `upload.derive` is now `configure`, the
>   whole-config step, so there is one seam instead of two. See `restructure-handoff.md` rule 6.
> - **`rime.{prototypeName}(slug)`** — accessors are generated per prototype
>   (`prototype/accessors.server.ts`) but the local API is still reached as
>   `rime.collection(slug)` / `rime.area(slug)`, and `is('singleton')` does not exist. `singleton`
>   is on the definition, which is what the adapter reads.
> - **`extends('prototypeName')`** — a feature does not declare which prototypes it extends; the
>   prototypes list the features. That direction is deliberate: a prototype's `features` list is
>   also its _order_, and order is the thing a feature cannot know.
>
> `isArea` / `isCollection` is down to 15 lines in core and 1 in the adapter, with 14 left in the
> panel — where some kind-shaped branch legitimately survives (`coupling-audit.md` §5).

- prototypes : `base` tables
  - With singleton flag

An area is a prototype, singleton on —> create and delete off.
A collection is a prototype, singleton off.

- features : extends base table, as shadow, add child type
  - can provide
    - boot hook
    - sveltekit handler
    - configure —> this way like plugins it can add hooks to other collections
    - provide type defintion for config ex: upload, versions
    - extends('prototypeName')

No `derive`, `augment`, ...

Then rime itself could be simplified no more isArea ... isCollection, the rime local api become :

```ts
createRimecontext(){
  return {
  ...prototypes
  }
}

// then :
const myAreaOrwhatever = rime.{prototypeName}(prototypeSlug)

if( myAreaOrwhatever.is('singleton') ){

}
```

> The adapter understand the prototype definition and the contract it brings with it [see](docs/decoupling-adapter.md)

A prototype can be defined :

const collection = definePrototype()
const area = definePrototype({ singleton: true })

A feature can be defined :

```ts
const upload = defineFeature({
  name: 'upload',
  extends: ['collections']
  type: 'augment',
  augment: augmentUpload, // (prototypeConfig) => augmentedPrototypeconfig
  hooks: {
    beforeBoot: [ensureMediasDir],
  }
})

declare module 'rimecms' {
  PrototypeNameConfig { // something like that
    upload: true | Uploadconfig
  }
}

// Other feature
import { augmentVersions } from '$rime/modules' // use runtime modules to simplify client/server augment.

const versions = defineFeature({
  name: 'versions',
  type: 'shadow',
  extends: ['collections', 'areas'],
  handler: SvelteKitHandler, // just possible not needed for versions I guess
  hooks: {
    beforeBoot: [...],
    afterBoot: [...],
    beforeCodeGen: [...],
    afterCodeGen: [...],
    beforeOperation: [...],
  }
})
// Will create tables for all prototypes :
// {base}__versions
```

```ts
const relations = defineFeature({
  name: 'relation',
  type: 'child',
  extends: ['collections', 'areas'],
  hooks: {
    beforeBoot: [...],
    afterBoot: [...],
    beforeCodeGen: [...],
    afterCodeGen: [...],
    beforeOperation: [...],
    persistance: [
      getRelationDiff,
      callAdapterSaveOnChildNamed__$relation_for_currentproto,
    ] // on update / create
  },
  transform: [
    (arg: {document: RawDoc, configMap: ConfigMap }) => tranformDocument(document)
  ]
})

// Will create tables for all prototypes :
// {base}__$relation
// if prototype has shadow then
// {base}__{shadow}__$relation

// Then a field relation just wired to the feature.
```

```ts
const directories = defineFeature({
  name: 'directories',
  requires: ['upload']
  extends: ['collections'],
  type: 'augment',
  configure: (wholeConfig) => augmentedConfigWithDirectoriesCollections,
  api: { // what go into rime.{extends[n]}
    isDirectory: (proto) => regexpTestOverTheNameingconventionCreatedinConfigure(proto.slug)
    // then rime.collections.isDirectory()
  },
  hooks: {
    beforeBoot: [...],
    afterBoot: [...],
    beforeCodeGen: [...],
    afterCodeGen: [...],
    beforeOperation: [...],
    persistance: [
      getRelationDiff,
    ] // on update / create
  }
})

// Will create tables for all prototypes :
// {base}__$relation
// if prototype has shadow then
// {base}__{shadow}__$relation

// Then a field relation just wired to the feature.
```

```ts
const blocks = defineFeature({
  name: 'blocks',
  type: 'child',
  extends: ['collections', 'areas'],
  hooks: {
    beforeBoot: [...],
    afterBoot: [...],
    beforeCodeGen: [...],
    afterCodeGen: [...],
    beforeOperation: [...],
    persistance: [
      getBlocksDiff,
    ], // on update / create
    transform: [
      (arg: {document: RawDoc, configMap: ConfigMap }) => tranformDocument(document)
    ]
  }
})
```

The contract :

```ts
type Feature = {
  name: text;
  requires: Feature['name'][];
  extends: [string | prototypeName][];
  type: 'child' | 'shadow' | 'augment'; // not sure completely about this
  configure: (config: C) => WithWathever<C>;
  augment: (proto: P) => WithWathever<P>;
  hooks: {
    beforeBoot: BootHook[]; // or just FeatureHook => (args: { event, context }) => { event, context }
    afterBoot: BootHook[]; // or just FeatureHook
    beforeCodeGen: CodeGenHook[]; // or just FeatureHook
    afterCodeGen: CodeGenHook[]; // or just FeatureHook
    beforeOperation: RuntimeHook[]; // or just FeatureHook
    persistance: RuntimeHook[]; // or just FeatureHook
    transform: TransformHook[]; // or just FeatureHook
  };
};

function defineFeature(arg: Feature) {
  return arg;
}
```

Features type :

`shadow` -> deviated the prototype table —> trigger adapter gen action
`child` -> create child table with ref to owner —> trigger adapter gen action
`augment` -> don't trigger the adapter directly, just augment or configure.

Then for all hooks place :

```ts
import * as features from 'core/features/index.ts'

for const feature of features {
  runFeatureHooks({
    hooks: feature.hooks.beforeBoot,
    event,
  })
}
```

Some idea for auth api keys

```ts
const apiKeys = defineFeature({
  name: 'apiKey',
  requires: ['auth']
  extends: {
    collections: {
      type: 'augment',
      augment: (proto) => createAPIKeysFields(proto)
    },
    handler: HandleAPIKeyStuffs
  }
})
```

For base auth feature it is hard because of better-auth schema stuff.
Better-auth provide a cli that output a DB migration file
The problem is that it need a config file and better-auth config is built :

```ts
`core/features/auth/boot.server.ts`;
const baseAuthConfig = getBaseAuthConfig({ mailer: plugins.mailer, config: configCtx });
const auth = betterAuth({
  ...baseAuthConfig,
  plugins: Array.isArray(config.$auth?.plugins)
    ? [...baseAuthConfig.plugins, ...(config.$auth.plugins as typeof config.$InferAuthPlugins)]
    : baseAuthConfig.plugins,
  database: adapter.auth.betterAuthAdapter
});
```

how to ? ...

```ts
const auth = defineFeature({
  name: 'auth',
  extends: {
    // ... ???? actually it provide access on fields and prototype ...
    handler: HandleAPIKeyStuffs
  }
});
```

I think auth is core not a feature full stop.
