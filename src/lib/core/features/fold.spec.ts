import { describe, expect, it } from 'vitest';
import { collection } from '$lib/core/prototype/collection/index.js';
import type { Docs, DocType } from '$lib/core/prototype/types.js';
import type { ConfigureTransforms, FeatureConfigure } from './register.js';
import { configureWithFeatures, shadowOf } from './fold.js';

/**
 * `ApplyFeatureConfigure` intersects every declared `configure` transform instead of folding a
 * hand-written tuple of feature names, and that is only sound while every transform is
 * **additive** — `T & {…}`. One that removed or replaced a member would need an order to be
 * meaningful, and an intersection would keep the member it meant to drop.
 *
 * The assertions are type-level; the `expect` below only gives them a home. A non-additive
 * declaration fails the *compile*, which is the point — there is no runtime shape to check.
 */
describe('every feature configure transform is additive', () => {
  type Probe = { $probe: 'probe' };

  /** `true` for each declared transform that still extends what it was handed. */
  type Additive = {
    [K in keyof FeatureConfigure<Probe>]: FeatureConfigure<Probe>[K] extends Probe ? true : false;
  }[keyof FeatureConfigure<Probe>];

  const noneIsSubtractive: [Exclude<Additive, true>] extends [never] ? true : false = true;

  /**
   * And `ConfigureTransforms` names every declaration. Missing one is the failure the old
   * `configureOrder` test existed to catch, and it is now a compile error rather than an
   * assertion — a name absent here means that feature's transform silently never applies.
   */
  const everyDeclarationIsListed: [
    Exclude<keyof FeatureConfigure<Probe>, ConfigureTransforms[number]>
  ] extends [never]
    ? true
    : false = true;

  it('holds for every declaration merged into FeatureConfigure', () => {
    expect([noneIsSubtractive, everyDeclarationIsListed]).toEqual([true, true]);
  });
});

/**
 * And the fold's *result*, which is what the tuple existed to produce: the members `panel` and
 * `cors` add through `configure` have to be there, and not `any`.
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

/**
 * A shadow is what makes the adapter build a second table, and nothing else does. The failure to
 * catch is silent in both directions: a config that stops declaring one loses every column that
 * moved onto the shadow, and one that starts declaring a shadow for a derived config would
 * generate a shadow of a shadow.
 */
describe('shadowOf', () => {
  it('names the shadow of a versioned config', () => {
    expect(shadowOf(collection.features, { slug: 'pages', versions: {} })).toEqual({
      slug: '$pages__versions'
    });
  });

  it('gives a config with no versions no shadow', () => {
    expect(shadowOf(collection.features, { slug: 'pages' })).toBeUndefined();
  });

  it('gives the derived shadow collection no shadow of its own', () => {
    expect(
      shadowOf(collection.features, { slug: '$pages__versions', versions: undefined })
    ).toBeUndefined();
  });
});

/**
 * `Docs` used to spell four feature document shapes itself, which is why
 * `core/prototype/types.ts` imported `UploadPath` and `VersionsStatus` out of two features to
 * describe its own registry. They are `FeatureDocTypes` declarations now, beside the feature that
 * means each one.
 *
 * The assertion is type-level, like the two above, and it is checking something a runtime test
 * cannot: that the declarations are *seen*. A `declare module` in a file nothing imports is not an
 * error — the key simply never appears, `DocType` silently narrows, and every `OperationContext<'version'>`
 * stops compiling somewhere far away.
 */
describe('every feature document shape reaches the Docs registry', () => {
  type Contributed = 'upload' | 'version' | 'auth' | 'directory';

  const everyShapeIsRegistered: [Exclude<Contributed, DocType>] extends [never] ? true : false =
    true;

  /** And each resolves to the feature's own type, not to `any` from a missing declaration. */
  const uploadIsTheUploadDoc: Docs['upload'] extends { mimeType: string } ? true : false = true;
  const versionIsTheVersionDoc: Docs['version'] extends { status: string } ? true : false = true;

  it('holds', () => {
    expect([everyShapeIsRegistered, uploadIsTheUploadDoc, versionIsTheVersionDoc]).toEqual([
      true,
      true,
      true
    ]);
  });
});
