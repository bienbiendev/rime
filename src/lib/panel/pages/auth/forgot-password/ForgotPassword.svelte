<script lang="ts">
  import { t__ } from '#lib/core/i18n/index.js';
  import { panelUrl } from '#lib/core/routes/util.js';
  import Email from '#lib/fields/email/component/Email.svelte';
  import AuthForm from '#lib/panel/components/sections/auth/AuthForm.svelte';
  import Button from '#lib/panel/components/ui/button/button.svelte';
  import { createFormStore } from '#lib/panel/context/form.svelte.js';
  import { emailField } from '#lib/panel/pages/auth/fields.js';
  import { authClient, authRequest } from '#lib/panel/util/auth.js';

  type Props = {
    data: {
      image: string | null;
    };
  };
  const { data }: Props = $props();

  const context = createFormStore({});

  let success = $state(false);
  let sending = $state(false);

  /** Asks for the reset mail, once: a second submit while it runs does nothing. */
  async function sendResetPasswordMail(event: SubmitEvent) {
    event.preventDefault();
    if (sending) return;
    sending = true;
    try {
      const answer = await authRequest(() =>
        authClient.requestPasswordReset({
          email: context.values.email,
          redirectTo: panelUrl('reset-password')
        })
      );
      if (answer?.status) success = true;
    } finally {
      sending = false;
    }
  }
</script>

<AuthForm image={data.image} title={t__('common.forgotPassword')}>
  {#if success}
    <p>{t__('common.passwordResetLinkSent', context.values.email)}</p>
  {:else}
    <form onsubmit={sendResetPasswordMail}>
      <Email config={emailField()} form={context} />
      <Button size="xl" type="submit" disabled={!context.canSubmit || sending}>
        {t__('common.requestPasswordReset')}
      </Button>
    </form>
  {/if}
</AuthForm>

<style lang="postcss">
  @import '../../../style/mixins/index.css';

  p {
    font-size: var(--rz-text-lg);
    @mixin font-semibold;
  }
</style>
