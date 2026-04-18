<script lang="ts">
  import Button from '../../ui/button/button.svelte';
  import type { ButtonProps, ButtonVariant } from '../../ui/button/index.js';
  import SpinLoader from '../../ui/spin-loader/SpinLoader.svelte';
  import { Save } from '@lucide/svelte';

  type Props = {
    variant?: ButtonVariant;
    disabled: boolean;
    processing: boolean;
    class?: string;
    label: string;
  } & ButtonProps;

  const {
    formaction,
    variant = 'default',
    disabled,
    processing,
    label,
    class: className,
    ...restProps
  }: Props = $props();
</script>

<Button
  {variant}
  formaction={formaction || null}
  class={className || null}
  type="submit"
  {disabled}
  {...restProps}
>
  {#if processing}
    <SpinLoader />
  {:else}
    <Save size="13" />
  {/if}
  {label}
</Button>
