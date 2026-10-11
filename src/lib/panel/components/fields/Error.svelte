<script lang="ts">
  import { errorText } from '#lib/panel/util/error-text.js';

  type Props = { error: string | false };

  const { error }: Props = $props();
</script>

{#if error}
  <div class="rz-field-error">
    {errorText(error)}
  </div>
{/if}

<style type="postcss">
  @import '../../style/mixins/index.css';
  .rz-field-error {
    color: var(--rz-accent-fg);
    background-color: var(--rz-danger);
    position: absolute;
    right: 0;
    top: 0;
    border-radius: var(--rz-radius-sm);
    font-size: var(--rz-text-xs);
    padding-inline: var(--rz-size-1);
    padding-block: var(--rz-size-0-5);
    @mixin font-medium;
  }
</style>
