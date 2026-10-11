import { describe, expect, test } from 'vitest';
import { areaHooks } from '../area/hooks.server.js';
import { collectionHooks } from '../collection/hooks.server.js';

/** The hook a list entry runs: `when(guard, hook)` keeps it as `.step`. */
const stepOf = (entry: any) => entry.step ?? entry;

/** The hooks of `list` that `other` runs too, in the order of `list`. */
const shared = (list: unknown[] = [], other: unknown[] = []) => {
  const others = other.map(stepOf);
  return list.map(stepOf).filter((hook) => others.includes(hook));
};

/** The names of the hooks `list` places and `other` does not. */
const onlyIn = (list: unknown[] = [], other: unknown[] = []) => {
  const others = other.map(stepOf);
  return list
    .map(stepOf)
    .filter((hook) => !others.includes(hook))
    .map((hook: any) => hook.name);
};

describe('area and collection hooks', () => {
  // A hook placed in one list and forgotten in the other never runs on that prototype
  test.each([
    ['beforeOperation', []],
    ['beforeRead', []],
    ['beforeUpdate', []],
    ['afterUpdate', ['syncAreaUrl']]
  ] as const)('the %s hooks an area runs and a collection does not: %j', (timing, expected) => {
    expect(onlyIn(areaHooks[timing], collectionHooks[timing])).toEqual(expected);
  });

  test.each(['beforeOperation', 'beforeRead', 'beforeUpdate', 'afterUpdate'] as const)(
    'the %s hooks both run come in the same order',
    (timing) => {
      const area = areaHooks[timing];
      const collection = collectionHooks[timing];
      expect(shared(area, collection)).toEqual(shared(collection, area));
    }
  );
});
