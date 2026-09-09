import { describe, expect, it } from 'vitest';
import { collection } from '$lib/core/prototype/collection/index.js';
import { configureWithFeatures } from './fold.js';

/**
 * What the config chain guarantees is there once `configure` has run: `panel` and `icons` from
 * the panel feature, `$trustedOrigins` from cors — present, and not `any`.
 *
 * These were produced by `ApplyFeatureConfigure`, a recursion over a hand-written list of the two
 * features that merged a declaration into `FeatureConfigure`. `configureWithFeatures` declares
 * them directly now, from `BuiltConfig`, which already spelled all three out. What must not
 * regress is that they survive a **generic** caller — `bootRime<C>` reads `config.panel.language`
 * while `C` is a type parameter, and an intersection over a key union stays deferred there.
 */
describe('configureWithFeatures', () => {
  const built = configureWithFeatures(collection.features, { $probe: 'probe' as const });

  type Built = typeof built;
  type IsAny<T> = 0 extends 1 & T ? true : false;

  const trustedOriginsIsTyped: IsAny<Built['$trustedOrigins']> = false;
  const panelIsTyped: IsAny<Built['panel']> = false;
  const iconsIsTyped: IsAny<Built['icons']> = false;
  /** What it was handed survives — the fold intersects with `T`, it does not replace it. */
  const inputSurvives: Built['$probe'] = 'probe';

  it('types what each feature configure declares', () => {
    expect([trustedOriginsIsTyped, panelIsTyped, iconsIsTyped, inputSurvives]).toEqual([
      false,
      false,
      false,
      'probe'
    ]);
  });

  it('and actually produces it', () => {
    expect(Array.isArray(built.$trustedOrigins)).toBe(true);
    expect(built.panel.language).toBeDefined();
    expect(built.$probe).toBe('probe');
  });
});
