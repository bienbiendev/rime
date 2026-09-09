import { describe, expect, it } from 'vitest';
import { assertMarks, HOOK_MARKS, markProblem } from './marks.js';
import type { HookMark } from './types.js';

/**
 * Who may name a mark, and what happens to a name nobody owns.
 *
 * The vacuous rule cannot tell "nothing active provides this" from "nothing spells this the same
 * way" — both are already-satisfied, both silently reorder the pipeline, and neither reports
 * anything. `HookMark` being a closed union covers this repo's own hooks. It does not cover a
 * consumer, who reaches the same union through declaration merging and can put any string in it.
 *
 * So the namespace is checked at boot, and these are the four answers it can give.
 */
describe('mark namespaces', () => {
  it('accepts a core mark', () => {
    expect(markProblem(HOOK_MARKS.SHAPED)).toBeUndefined();
  });

  it('accepts an owned mark', () => {
    expect(markProblem('upload:file-written')).toBeUndefined();
  });

  it('refuses a bare name, because a second owner would reach for the same one', () => {
    // The case this exists for. `session` is exactly the kind of word two people pick
    // independently, and two owners providing it join one set rather than colliding.
    expect(markProblem('session')).toMatch(/is not "owner:name"/);
  });

  it('refuses a misspelled core mark rather than satisfying it vacuously', () => {
    expect(markProblem('core:shpaed')).toMatch(/reserved "core" namespace/);
  });

  it('refuses half of an owned name', () => {
    expect(markProblem('upload:')).toMatch(/is not "owner:name"/);
  });
});

describe('assertMarks', () => {
  const hook = (name: string, requires: string[] = [], provides: string[] = []) => ({
    name,
    requires,
    provides
  });

  it('says nothing when every name belongs to someone', () => {
    expect(() =>
      assertMarks(
        [hook('authorize', [HOOK_MARKS.SHAPED], ['upload:file-written'])],
        'pages beforeRead'
      )
    ).not.toThrow();
  });

  it('names the pipeline and the hook, so the message says where to look', () => {
    expect(() => assertMarks([hook('mine', ['session'])], 'pages beforeOperation')).toThrow(
      /pages beforeOperation[\s\S]*mine: "session"/
    );
  });

  it('checks provides as well as requires', () => {
    expect(() => assertMarks([hook('mine', [], ['ready'])], 'pages beforeRead')).toThrow(/ready/);
  });
});

/**
 * What a **consumer's** hook gets, since that is the case this whole thing exists for.
 *
 * A consumer's hooks go into the same array `buildPipeline` hands the resolver — same list, same
 * `assertMarks` — so the four answers below are what an app sees at boot, not a special case.
 */
describe('a consumer hook', () => {
  const consumer = (requires: string[], provides: string[] = []) => [
    { name: 'myAppHook', requires, provides }
  ];

  it('may require a rime mark, which is the ordinary case', () => {
    // Declaring nothing gets exactly this: `Hooks.beforeRead` defaults to `__shaped`/`__document`,
    // so an app that never heard of marks is already legal.
    expect(() =>
      assertMarks(consumer([HOOK_MARKS.SHAPED], [HOOK_MARKS.DOCUMENT]), 'pages beforeRead')
    ).not.toThrow();
  });

  it('may add its own, under its own name', () => {
    expect(() =>
      assertMarks(consumer([HOOK_MARKS.SHAPED], ['myapp:priced']), 'pages beforeRead')
    ).not.toThrow();
  });

  it('throws on a bare name of its own', () => {
    expect(() => assertMarks(consumer([HOOK_MARKS.SHAPED], ['ready']), 'pages beforeRead')).toThrow(
      /myAppHook: "ready" is not "owner:name"/
    );
  });

  it('throws on a pre-namespace mark, which is the upgrade path', () => {
    // `requires: ['shaped']` was legal before marks were namespaced. It has to fail loudly rather
    // than vacuously: satisfied-by-nobody would put the hook first and change nothing visible.
    expect(() => assertMarks(consumer(['shaped']), 'pages beforeRead')).toThrow(
      /is not "owner:name"/
    );
  });
});

/**
 * The union is still closed.
 *
 * Worth its own guard because it broke silently once while this was being written: declaring the
 * feature merge as `interface FeatureHookMarks extends Record<typeof MARKS[keyof typeof MARKS],
 * true>` widened `keyof FeatureHookMarks` to `string | number`, which opens `HookMark` to every
 * string. Nothing failed — the boot check still ran, and the compile-time half, which is the
 * stronger one, was simply gone.
 *
 * Each `@ts-expect-error` below is the assertion: if the union opened, the directive would be
 * unused and *that* is the compile error.
 */
describe('HookMark stays closed', () => {
  // @ts-expect-error a bare word is not a mark
  const bare: HookMark = 'session';
  // @ts-expect-error a misspelled core mark is not a mark
  const misspelled: HookMark = 'core:shpaed';
  // @ts-expect-error a namespace nobody declared is not a mark
  const undeclared: HookMark = 'whoever:thing';

  /** And what a feature declared is, through `FeatureHookMarks`. */
  const declared: HookMark = 'versions:operation';

  it('holds', () => {
    expect([bare, misspelled, undeclared, declared]).toHaveLength(4);
  });
});
