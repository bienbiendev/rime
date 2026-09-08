import { text } from '$lib/fields/text/index.js';
import { validate } from '$lib/util/index.js';

/**
 * The password field, appended to an auth collection at write time by
 * `hooks/augment-fields-password.server.ts`.
 *
 * `.server` because it is not part of any config: `augmentAuth` never adds it, so it reaches no
 * built config and no client build. It used to sit in the isomorphic `fields.ts` inside
 * `usersFields`, which put a password field definition — validator included — in every browser
 * bundle for no reason, since the only thing that ever read it is a server hook.
 *
 * No `confirmPassword` here on purpose. It is a form control, not a document field: the panel owns
 * the match check (AuthFooter.svelte builds its own `text('confirmPassword')`), because comparing
 * two values the same client just sent proves nothing server-side. Modelling it as a field would
 * force `restCreate` to fake a value for it.
 */
export const passwordField = text('password')
  .required()
  .access({
    create: () => true,
    read: () => false,
    update: () => false
  })
  .validate((value) => validate.password(value));
