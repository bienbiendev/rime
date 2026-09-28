<script lang="ts">
  import type { BuiltCollection } from '$lib/types';
  import { t__ } from '../../../../core/i18n/index.js';

  type Props = { config: BuiltCollection };
  const { config }: Props = $props();
</script>

<div class="rz-no-document">
  <div>
    <span>
      {config.label.none || t__(`common.no_document`, config.label.singular)}
    </span>
  </div>
</div>

<style lang="postcss">
  .rz-no-document {
    height: var(--rz-input-height);
    background-color: var(--rz-bg-well);
    color: var(--rz-fg-subtle);
    display: flex;
    align-items: center;
    border-radius: var(--rz-radius-md);
    padding: var(--rz-size-3);
    border: 1px solid var(--rz-border);
  }
</style>
