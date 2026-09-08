import { expect, test } from 'vitest';
import type { BuiltArea, BuiltCollection, BuiltConfig, Config } from '$lib/core/config/types.js';
import type { PrototypeMembers } from './register.js';

/**
 * The authoring seam, guarded.
 *
 * `Config` and `BuiltConfig` no longer name `collections` or `areas`: each prototype merges its
 * own member into `PrototypeMembers` beside its definition. That is a declaration-merging target,
 * and the failure mode of one is silence — a definition that stops being reachable, or an
 * augmentation written against the wrong module path, leaves the interface **empty** rather than
 * raising anything. `Config` would quietly lose the member and every `config.collections` in the
 * repo would start reading `any` or erroring far from the cause.
 *
 * So: assert the merged shape, both directions. These are type-level, which means **`bun run
 * check` is the gate, not `vitest`** — the runtime assertions below pass either way, because
 * `false` still equals `false` once the type has widened. Dropping one prototype's augmentation
 * was tried: `check` goes from 0 to 36 errors, two of them on these lines naming the missing
 * member. Same arrangement as `config/inference.spec.ts`.
 */

/** `false` once the member has been widened away or lost. */
type Has<T, K extends PropertyKey> = K extends keyof T ? true : false;
/** `true` when the member may be left out. */
type IsOptional<T, K extends keyof T> = undefined extends T[K] ? true : false;
type IsNever<T> = [T] extends [never] ? true : false;

// --- every registered prototype merged its member, and nothing else did -------------------
const noUnexpectedMember: IsNever<Exclude<keyof PrototypeMembers, 'collections' | 'areas'>> = true;
const collectionsMerged: Has<PrototypeMembers, 'collections'> = true;
const areasMerged: Has<PrototypeMembers, 'areas'> = true;

// --- the authoring surface: present, optional, and the right element type -----------------
const configHasCollections: Has<Config, 'collections'> = true;
const configHasAreas: Has<Config, 'areas'> = true;
const collectionsAreOptional: IsOptional<Config, 'collections'> = true;
const areasAreOptional: IsOptional<Config, 'areas'> = true;

const authoredCollection: NonNullable<Config['collections']>[number] =
  null as unknown as BuiltCollection;
const authoredArea: NonNullable<Config['areas']>[number] = null as unknown as BuiltArea;

// --- the built surface: the same members, with the optionality gone -----------------------
// This is the one downstream depends on: `prototypeConfigs`, the schema generator and the
// dashboard all read `config.collections` with no guard, because every prototype's `configure`
// defaults its list to `[]`. If `Required<PrototypeMembers>` ever stopped applying, those reads
// would be the crash site rather than this line.
const builtHasCollections: Has<BuiltConfig, 'collections'> = true;
const builtCollectionsAreRequired: IsOptional<BuiltConfig, 'collections'> = false;
const builtAreasAreRequired: IsOptional<BuiltConfig, 'areas'> = false;

test('every prototype contributes its authoring member, and only its own', () => {
  expect([noUnexpectedMember, collectionsMerged, areasMerged]).toEqual([true, true, true]);
});

test('the authoring surface carries them as optional lists', () => {
  expect([configHasCollections, configHasAreas, collectionsAreOptional, areasAreOptional]).toEqual([
    true,
    true,
    true,
    true
  ]);
  expect([authoredCollection, authoredArea]).toEqual([null, null]);
});

test('the built surface carries them as required lists', () => {
  expect([builtHasCollections, builtCollectionsAreRequired, builtAreasAreRequired]).toEqual([
    true,
    false,
    false
  ]);
});
