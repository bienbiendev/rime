import { describe, expect, it } from 'vitest';
import { text } from '$lib/fields/text/index.js';
import { collection, create } from '$lib/core/prototype/collection/definition.js';
import { validateWithFeatures } from '$lib/core/features/fold.js';
import { validateAuth } from './validate.js';

/**
 * Auth's config rules, and the contract member that now carries them.
 *
 * They used to sit in `config/validate.server.ts` behind an `isAuthConfig` test. The risk in
 * moving them is not that they break — it is that they silently stop running, which no other gate
 * would notice: a config that should be rejected would simply be accepted, and the first symptom
 * is a sign-in path reading a collection that cannot serve it.
 */
describe('validateAuth', () => {
  it('passes a collection auth built itself', () => {
    const built = create('spec_users', { auth: true, fields: [text('bio')] });

    expect(validateAuth(built)).toEqual([]);
  });

  it('refuses a versioned auth collection', () => {
    const built = create('spec_versioned_users', { auth: true, versions: true, fields: [] });

    expect(validateAuth(built)).toContain(
      "Auth collections can't be versionned (spec_versioned_users)"
    );
  });

  it('names each field it needs', () => {
    const errors = validateAuth({ slug: 'spec_bare', fields: [] } as any);

    expect(errors).toEqual([
      'Field roles is missing in collection spec_bare',
      'Field email is missing in collection spec_bare',
      'Field name is missing in collection spec_bare'
    ]);
  });

  it('does not need an email field for an apiKey collection', () => {
    const errors = validateAuth({
      slug: 'spec_keys',
      auth: { type: 'apiKey' },
      fields: []
    } as any);

    expect(errors).not.toContain('Field email is missing in collection spec_keys');
  });

  /**
   * The old code read `rolesField.get.many` without checking `rolesField` existed, so a collection
   * whose `roles` is not a select crashed codegen with a TypeError instead of reporting the two
   * things actually wrong with it.
   */
  it('reports a non-select roles field instead of throwing on it', () => {
    const errors = validateAuth({ slug: 'spec_badroles', fields: [text('roles')] } as any);

    expect(errors).toContain('Field roles is missing in collection spec_badroles');
  });
});

/**
 * And the wiring: the rules have to be reached through the feature list, gated by `enabled`, or
 * they are just a function nobody calls.
 */
describe('validateWithFeatures', () => {
  it('reports a feature rule for a config that uses the feature', () => {
    const built = create('spec_wired', { auth: true, versions: true, fields: [] });

    expect(validateWithFeatures(collection.features, built)).toContain(
      "Auth collections can't be versionned (spec_wired)"
    );
  });

  it('says nothing about a config that does not use it', () => {
    const built = create('spec_plain', { versions: true, fields: [text('title').isTitle()] });

    expect(validateWithFeatures(collection.features, built)).toEqual([]);
  });
});
