import { describe, expect, it } from 'vitest';
import { email } from '#lib/fields/email/index.js';
import { select } from '#lib/fields/select/index.js';
import { text } from '#lib/fields/text/index.js';
import { create } from '#lib/core/prototype/collection/definition.js';
import { validateAuth } from './validate-config.js';

/**
 * Auth's config rules. A rule that stops running lets a collection through that cannot serve
 * sign-in, and nothing else would notice.
 */
describe('validateAuth', () => {
  it('passes a collection auth built itself', () => {
    const built = create('spec_users', { auth: true, fields: [text('bio')] });

    expect(validateAuth(built)).toEqual([]);
  });

  it('refuses a versioned auth collection', () => {
    const built = create('spec_versioned_users', { auth: true, versions: true, fields: [] });

    expect(validateAuth(built)).toContain(
      "Auth collections can't be versioned (spec_versioned_users)"
    );
  });

  it('names each field it needs', () => {
    const errors = validateAuth({ slug: 'spec_bare', auth: true, fields: [] } as any);

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

  /** A `roles` field that is not a select is reported, not read. */
  it('reports a non-select roles field instead of throwing on it', () => {
    const errors = validateAuth({
      slug: 'spec_badroles',
      auth: true,
      fields: [text('roles')]
    } as any);

    expect(errors).toContain('Field roles is missing in collection spec_badroles');
  });

  it('asks for `many` on roles, even with a single option', () => {
    const errors = validateAuth({
      slug: 'spec_single_role',
      auth: true,
      fields: [select('roles').options('a'), text('name'), email('email')]
    } as any);

    expect(errors).toEqual([
      `Field roles must have "many" enabled : select('roles').options(...).many(), even with a single option`
    ]);
  });
});

/**
 * And the guard: these rules only apply to a collection that declares `auth`. It is the function's
 * own first line, which is why every case above states `auth`.
 */
describe('the auth guard', () => {
  it('says nothing about a collection that does not', () => {
    const built = create('spec_plain', { versions: true, fields: [text('title').isTitle()] });

    expect(validateAuth(built)).toEqual([]);
  });
});
