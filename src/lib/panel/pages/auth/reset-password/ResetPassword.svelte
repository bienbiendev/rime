<script lang="ts">
  import { t__ } from '$lib/core/i18n';
  import Text from '$lib/fields/text/component/Text.svelte';
  import AuthForm from '$lib/panel/components/sections/auth/AuthForm.svelte';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import { setFormContext } from '$lib/panel/context/form.svelte';
  import { passwordField } from '$lib/panel/pages/auth/fields.js';
  import { authClient } from '$lib/panel/util/auth';
  import { toast } from 'svelte-sonner';

  let success = $state(false);

  const form = setFormContext({}, 'reset-password');

  type Props = {
    data: {
      image: string | null;
    };
  };
  const { data }: Props = $props();

  const passwordConfig = {
    ...passwordField,
    placeholder: t__('common.newPassword')
  };
  const confirmPasswordConfig = {
    ...passwordField,
    name: 'confirmPassword',
    placeholder: t__('common.confirmPassword')
  };

  async function resetPassword() {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      return toast.error('An error occured');
    }
    const { data, error } = await authClient.resetPassword({
      newPassword: form.values.password,
      token
    });
    if (error) {
      console.error(error);
      return toast.error(error.message || 'An error occured');
    }
    success = data?.status;
  }
</script>

<AuthForm image={data.image} title={t__('common.resetPassword')}>
  {#if success}
    <p>{t__('common.reset_password_success')}</p>
    <Button size="xl" href="/panel/sign-in">{t__('common.signin')}</Button>
  {:else}
    <Text type="password" config={passwordConfig} {form} />
    <Text type="password" config={confirmPasswordConfig} {form} />

    <Button
      size="xl"
      disabled={!(form.canSubmit && form.values.password && form.values.confirmPassword)}
      onclick={resetPassword}
    >
      {t__('common.resetPassword')}
    </Button>
  {/if}
</AuthForm>
