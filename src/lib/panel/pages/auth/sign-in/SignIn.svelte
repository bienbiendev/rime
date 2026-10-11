<script lang="ts">
  import { enhance } from '$app/forms';
  import { t__ } from '#lib/core/i18n/index.js';
  import { panelPath, panelUrl } from '#lib/core/routes/util.js';
  import Email from '#lib/fields/email/component/Email.svelte';
  import Text from '#lib/fields/text/component/Text.svelte';
  import AuthForm from '#lib/panel/components/sections/auth/AuthForm.svelte';
  import Button from '#lib/panel/components/ui/button/button.svelte';
  import SpinLoader from '#lib/panel/components/ui/spin-loader/SpinLoader.svelte';
  import { createFormStore } from '#lib/panel/context/form.svelte.js';
  import { emailField, passwordField } from '#lib/panel/pages/auth/fields.js';
  import type { FormErrors } from '#lib/types.js';
  import KeyRound from '@lucide/svelte/icons/key-round';
  import { toast } from 'svelte-sonner';

  type Props = {
    data: {
      forgotPasswordEnabled: boolean;
      image: string | null;
      form: { email?: string; password?: string; errors?: FormErrors };
    };
  };
  const { data }: Props = $props();

  // svelte-ignore state_referenced_locally
  const context = createFormStore(data.form);

  $effect(() => {
    const formError = context.errors.get('_form');
    if (typeof formError === 'string') {
      toast.error(t__(`errors.${formError}`));
    }
  });
</script>

<AuthForm image={data.image} title={t__('common.signin')}>
  <form method="POST" action={panelPath('sign-in')} use:enhance={context.enhance}>
    <Email config={emailField()} form={context} />
    <Text
      type="password"
      icon={KeyRound}
      config={passwordField().layout('compact')}
      form={context}
    />
    <Button size="xl" disabled={!context.canSubmit} type="submit">
      {t__('common.signin')}
      {#if context.pending}
        <SpinLoader />
      {/if}
    </Button>

    {#if data.forgotPasswordEnabled}
      <Button variant="link" href={panelUrl('forgot-password')}>
        {t__('common.forgotPassword')}
      </Button>
    {/if}
  </form>
</AuthForm>
