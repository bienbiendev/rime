<script lang="ts">
  import { page } from '$app/state';
  import { isAuthConfig } from '$lib/core/auth/util';
  import type { BuiltCollection } from '$lib/core/config/types.js';
  import validate from '$lib/core/fields/validate';
  import { t__ } from '$lib/core/i18n';
  import { panelUrl } from '$lib/core/routes/util.js';
  import { text } from '$lib/fields';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { getUserContext } from '$lib/panel/context/user.svelte.js';
  import { authClient } from '$lib/panel/util/auth';
  import { toast } from 'svelte-sonner';
  import Button from '../../ui/button/button.svelte';

  type Props = { operation: string; form: DocumentFormContext; collection: BuiltCollection };
  const { operation, form, collection }: Props = $props();

  const user = getUserContext();

  $effect(() => {
    if (form.values.password !== form.values.confirmPassword && operation === 'create') {
      form.errors.set('__form', 'password_mismatch');
    } else {
      form.errors.delete('__form');
    }
  });

  async function sendPasswordResetLink() {
    const { data, error } = await authClient.requestPasswordReset({
      email: form.values.email,
      redirectTo: `${panelUrl('reset-password')}?slug=staff`
    });
    if (error && error.message) {
      toast.error(error.message);
    }
    if (data && data.status) {
      toast.success(t__('common.passwordResetLinkSent', form.values.email));
    }
  }

  const passwordConfig = text('password')
    .placeholder(t__('fields.password'))
    .required()
    .validate(validate.password);
  const Text = text('mock').component;

  const confirmPasswordConfig = text('confirmPassword')
    .label(t__('common.confirmPassword'))
    .placeholder(t__('common.confirmPassword'))
    .required()
    .validate((value, metas) => {
      if (metas.data.password !== value) {
        return 'password_mismatch';
      }
      return true;
    });
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
