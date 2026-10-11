<script lang="ts">
  import { t__ } from '#lib/core/i18n/index.js';
  import { panelUrl } from '#lib/core/routes/util.js';
  import Text from '#lib/fields/text/component/Text.svelte';
  import AuthForm from '#lib/panel/components/sections/auth/AuthForm.svelte';
  import Button from '#lib/panel/components/ui/button/button.svelte';
  import { createFormStore } from '#lib/panel/context/form.svelte.js';
  import { confirmPasswordField, newPasswordField } from '#lib/panel/pages/auth/fields.js';
  import { authClient } from '#lib/panel/util/auth.js';
  import { toast } from 'svelte-sonner';

  let success = $state(false);

  const form = createFormStore({});

  type Props = {
    data: {
      image: string | null;
    };
  };
  const { data }: Props = $props();

  const passwordConfig = newPasswordField().placeholder(t__('common.newPassword'));
  const confirmPasswordConfig = confirmPasswordField().placeholder(t__('common.confirmPassword'));
  const canReset = $derived(
    form.canSubmit && !!form.values.password && form.values.password === form.values.confirmPassword
  );

  async function resetPassword() {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      return toast.error(t__('common.generic_error'));
    }
    const { data, error } = await authClient.resetPassword({
      newPassword: form.values.password,
      token
    });
    if (error) {
      console.error(error);
      return toast.error(error.message || t__('common.generic_error'));
    }
    success = data?.status;
  }
</script>

<AuthForm image={data.image} title={t__('common.resetPassword')}>
  {#if success}
    <p>{t__('common.reset_password_success')}</p>
    <Button size="xl" href={panelUrl('sign-in')}>{t__('common.signin')}</Button>
  {:else}
    <Text type="password" config={passwordConfig} {form} />
    <Text type="password" config={confirmPasswordConfig} {form} />

    <Button size="xl" disabled={!canReset} onclick={resetPassword}>
      {t__('common.resetPassword')}
    </Button>
  {/if}
</AuthForm>
