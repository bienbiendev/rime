import { describe, expect, it } from 'vitest';
import { assertMarks, markProblem, RIME_MARKS } from './marks.js';
import type { CoreHookMark } from './types.js';

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
  it('accepts a rime mark', () => {
    expect(markProblem('__shaped')).toBeUndefined();
  });

  it('accepts an owned mark', () => {
    expect(markProblem('upload:file-written')).toBeUndefined();
  });

  it('refuses a bare name, because a second owner would reach for the same one', () => {
    // The case this exists for. `session` is exactly the kind of word two people pick
    // independently, and two owners providing it join one set rather than colliding.
    expect(markProblem('session')).toMatch(/no namespace/);
  });

  it('refuses a misspelled rime mark rather than satisfying it vacuously', () => {
    expect(markProblem('__shpaed')).toMatch(/reserved/);
  });

  it('refuses half of an owned name', () => {
    expect(markProblem('upload:')).toMatch(/missing one half/);
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
      assertMarks([hook('authorize', ['__shaped'], ['upload:file-written'])], 'pages beforeRead')
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
 * The union and the list are the same set, and they have to be written twice for a reason: the
 * union makes a misspelling a *compile* error inside this repo, the list makes it a *boot* error
 * for anything that reached the union through declaration merging, where the union cannot.
 *
 * Which means they can drift, so this is the thing that stops them. Both directions: a mark added
 * to one and not the other is a compile error here.
 */
describe('the union and the runtime list agree', () => {
  const everyListedMarkIsInTheUnion: CoreHookMark = RIME_MARKS[0];

  const everyUnionMemberIsListed: [Exclude<CoreHookMark, (typeof RIME_MARKS)[number]>] extends [
    never
  ]
    ? true
    : false = true;

  const nothingListedIsMissingFromTheUnion: [
    Exclude<(typeof RIME_MARKS)[number], CoreHookMark>
  ] extends [never]
    ? true
    : false = true;

  it('holds', () => {
    expect([
      everyListedMarkIsInTheUnion,
      everyUnionMemberIsListed,
      nothingListedIsMissingFromTheUnion
    ]).toEqual(['__sanitized', true, true]);
  });
});
