import { RimeFormError } from '$lib/core/errors/index.js';
import { text } from '$lib/fields/text/index.js';
import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import type { Field } from '$lib/fields/types.js';
import { describe, expect, test } from 'vitest';
import { buildConfigMap } from '../config-map/index.js';
import { validateFields } from './validate-fields.server.js';

/**
 * Guards the interaction between field-level write access and `required`.
 *
 * These two rules meet in one place and used to contradict each other: the access block
 * empties a field the request may not write, and the required block then reported the now-empty
 * field as missing. The caller could not win — it was not allowed to send the value that would
 * have satisfied the check.
 *
 * It is easy to think of this as an auth-collection quirk, because that is where it was found
 * (`confirmPassword` had no `.access()`, so an anonymous `POST /api/users` 400d on a field it
 * could not send, instead of 403ing on access). It is not. `FormFieldBuilder` defaults to
 * `access.create: (user) => !!user`, so this hits *any* publicly-creatable collection whose
 * fields do not each override it — a sign-up form, a contact form, a comment.
 *
 * No e2e fixture covers it: they all declare `create: () => true` on the fields they post.
 */

const runValidate = (args: {
  fields: FieldBuilder<Field>[];
  data: Record<string, unknown>;
  user?: unknown;
}) => {
  const config = { slug: 'members', fields: args.fields } as any;

  const event = {
    url: new URL('http://localhost/api/members'),
    locals: {
      user: args.user,
      locale: undefined,
      rime: { config: { isCollection: () => true } }
    }
  } as any;

  return validateFields({
    data: args.data,
    config,
    event,
    operation: 'create',
    context: { params: {}, configMap: buildConfigMap(args.data, args.fields) }
  } as any);
};

describe('validateFields: required vs. field access on create', () => {
  test('a required field the request may not write is dropped, not reported missing', async () => {
    // No .access() — so it keeps FormFieldBuilder's default `create: (user) => !!user`,
    // which an anonymous request fails.
    const fields = [text('nickname').required()];

    const result = await runValidate({ fields, data: { nickname: 'anon' }, user: undefined });

    // Dropped from both the data and the config map, exactly as before...
    expect(result.data).not.toHaveProperty('nickname');
    expect(result.context.configMap).not.toHaveProperty('nickname');
  });

  test('...and that drop no longer turns into an unsatisfiable REQUIRED_FIELD', async () => {
    const fields = [text('nickname').required()];

    // The regression this guards: an anonymous create used to throw here.
    await expect(
      runValidate({ fields, data: { nickname: 'anon' }, user: undefined })
    ).resolves.toBeDefined();
  });

  test('required still fires when the request may write the field but sent nothing', async () => {
    const fields = [text('nickname').required()];

    const promise = runValidate({ fields, data: { nickname: '' }, user: { id: 'u1' } });

    await expect(promise).rejects.toThrowError(RimeFormError);
    await expect(promise).rejects.toMatchObject({
      errors: { nickname: RimeFormError.REQUIRED_FIELD }
    });
  });

  test('required still fires for an anonymous request on a field opened to it', async () => {
    const fields = [text('nickname').required().access({ create: () => true })];

    const promise = runValidate({ fields, data: { nickname: '' }, user: undefined });

    await expect(promise).rejects.toMatchObject({
      errors: { nickname: RimeFormError.REQUIRED_FIELD }
    });
  });
});
