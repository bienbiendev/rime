Prototypes own their surface; the adapter stops knowing about kinds
Context
docs/architecture-target.md describes prototypes and features as definitions that bring their
own surface. I read it as “merge area into collection, branch on a flag”, and commit 1
(77a179e, pushed) built that: one PrototypeDefinition with singleton: boolean and a shared
boot loop. That is the wrong organising idea — merging every kind’s functionality into one blob
and branching on a flag makes a mess, not a structure.
The correction:
	•	definePrototype(args) takes arguments that define the prototype, and the definition
provides its own local API, its own operations, and its own REST. collection and area
are two definitions built to the same pattern — not one implementation with a discriminator.
singleton: true remains an argument (the doc uses it); it is not the mechanism.
	•	The adapter does not know what an area or a collection is. Its vocabulary is the one in
docs/decoupling-adapter.md: base, shadow, child, branch. It offers find, findMany,
insert, update, delete over a prototype, and knows nothing of kinds.
	•	On boot, prototypes register into the adapter. Afterwards
adapter.prototype('settings').… serves whatever that prototype’s base/shadow/children/
branches make available.
	•	Local API, operations and REST live inside the prototype definitions, not in parallel
operations/collection/, operations/area/, rest/collection/, rest/area/ trees.
	•	Anything shared, or spanning many parts, becomes a feature per the doc’s defineFeature
(type: 'child' | 'shadow' | 'augment', with boot/codegen/operation/persistence hooks).
Commit 1 is not thrown away: definePrototype, the extensions/ registry keyed by barrel
export name, configCtx.byPrototype(name), and the boot loop over registered prototypes all
survive. What changes is that a definition stops being only a flag and starts carrying its
surface, and adapter.area.ensureExists — which named a kind — goes.
The layering — what decides where a thing goes