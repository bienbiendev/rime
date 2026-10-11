<script lang="ts">
  import { t__ } from '#lib/core/i18n/index.js';
  import { panelUrl } from '#lib/core/routes/util.js';
  import Email from '#lib/fields/email/component/Email.svelte';
  import AuthForm from '#lib/panel/components/sections/auth/AuthForm.svelte';
  import Button from '#lib/panel/components/ui/button/button.svelte';
  import { createFormStore } from '#lib/panel/context/form.svelte.js';
  import { emailField } from '#lib/panel/pages/auth/fields.js';
  import { authClient } from '#lib/panel/util/auth.js';
  import { toast } from 'svelte-sonner';

  type Props = {
    data: {
      image: string | null;
    };
  };
  const { data }: Props = $props();

  const context = createFormStore({});

  let success = $state(false);

  async function sendResetPasswordMail() {
    const { data, error } = await authClient.requestPasswordReset({
      email: context.values.email,
      redirectTo: panelUrl('reset-password')
    });
    if (error && error.message) {
      toast.error(error.message);
    }
    if (data && data.status) {
      success = data.status;
    }
  }
</script>

<AuthForm image={data.image} title={t__('common.forgotPassword')}>
  {#if success}
    <p>{t__('common.passwordResetLinkSent', context.values.email)}</p>
  {:else}
    <Email config={emailField()} form={context} />
    <Button size="xl" disabled={!context.canSubmit} onclick={sendResetPasswordMail}>
      {t__('common.requestPasswordReset')}
    </Button>
  {/if}
</AuthForm>

<style lang="postcss">
  @import '../../../style/mixins/index.css';

  p {
    font-size: var(--rz-text-lg);
    @mixin font-semibold;
  }
</style>
