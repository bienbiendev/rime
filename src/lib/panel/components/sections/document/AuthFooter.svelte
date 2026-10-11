<script lang="ts">
  import { page } from '$app/state';
  import { isAuthConfig } from '#lib/core/auth/util.js';
  import type { BuiltCollection } from '#lib/core/config/types.js';
  import { RimeFormError } from '#lib/core/errors/index.js';
  import { t__ } from '#lib/core/i18n/index.js';
  import { panelUrl } from '#lib/core/routes/util.js';
  import { text } from '#lib/fields/index.js';
  import type { DocumentFormContext } from '#lib/panel/context/documentForm.svelte.js';
  import { confirmPasswordField, newPasswordField } from '#lib/panel/pages/auth/fields.js';
  import { getUserContext } from '#lib/panel/context/user.svelte.js';
  import { authClient } from '#lib/panel/util/auth.js';
  import { toast } from 'svelte-sonner';
  import Button from '../../ui/button/button.svelte';

  type Props = { operation: string; form: DocumentFormContext; collection: BuiltCollection };
  const { operation, form, collection }: Props = $props();

  const user = getUserContext();

  // Keeps Save disabled while the passwords differ, also after the password is edited again.
  // No component shows a `_form` error: the confirmation field shows the message.
  $effect(() => {
    if (operation === 'create' && form.values.password !== form.values.confirmPassword) {
      form.errors.set('_form', RimeFormError.PASSWORD_MISMATCH);
    } else {
      form.errors.delete('_form');
    }
  });

  async function sendPasswordResetLink() {
    const { data, error } = await authClient.requestPasswordReset({
      email: form.values.email,
      redirectTo: panelUrl('reset-password')
    });
    if (error && error.message) {
      toast.error(error.message);
    }
    if (data && data.status) {
      toast.success(t__('common.passwordResetLinkSent', form.values.email));
    }
  }

  const passwordConfig = newPasswordField().placeholder(t__('fields.password'));
  const Text = text('mock').component;

  const confirmPasswordConfig = confirmPasswordField()
    .label(t__('common.confirmPassword'))
    .placeholder(t__('common.confirmPassword'));
</script>

<!-- For creation show passwords fields -->
<!-- For updates show reset password if mailer plugin exists -->
{#if operation === 'create' || (user.attributes.isStaff && page.data?.hasMailer)}
  <div class="rz-document-auth">
    {#if operation === 'create'}
      {#if isAuthConfig(collection) && collection.auth.type === 'password'}
        <Text {form} type="password" config={passwordConfig} path="password" />
        <Text {form} type="password" config={confirmPasswordConfig} path="confirmPassword" />
      {/if}
    {:else if user.attributes.isStaff && page.data?.hasMailer}
      {#if isAuthConfig(collection) && collection.auth.type === 'password'}
        <div>
          <Button onclick={sendPasswordResetLink} variant="secondary" size="sm">
            {t__('common.sendPasswordResetLink')}
          </Button>
        </div>
      {/if}
    {/if}
  </div>
{/if}

<style lang="postcss">
  @import '../../../style/mixins/index.css';

  /* A card like a group's body: the password fields, 20px apart, 14px from its sides. */
  .rz-document-auth {
    @mixin surface raised;
    display: grid;
    gap: var(--rz-size-5);
    padding: var(--rz-size-4) var(--rz-size-3-5);
    border-radius: var(--rz-radius-xl);
  }

  /* Updating: the reset link alone, no card. */
  .rz-document-auth:not(:has(fieldset)) {
    padding: 0;
    background-color: transparent;
    box-shadow: none;
  }
</style>
