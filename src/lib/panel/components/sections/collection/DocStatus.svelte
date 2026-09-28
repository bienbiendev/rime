<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import {
    VERSIONS_STATUS,
    type VersionsStatus
  } from '$lib/core/prototype/shared/versions/constant.js';
  import StatusDot from './StatusDot.svelte';

  type Props = { status: VersionsStatus };
  const { status }: Props = $props();
</script>

<!-- A dot, then Draft or Published. -->
<span class="rz-doc-status">
  <StatusDot --rz-dot-size="var(--rz-size-1-5)" {status} />
  {status === VERSIONS_STATUS.DRAFT ? t__('common.draft') : t__('common.published')}
</span>

<style lang="postcss">
  .rz-doc-status {
    display: inline-flex;
    align-items: center;
    gap: var(--rz-size-1-5);
    color: var(--rz-fg-muted);
    font-size: var(--rz-text-sm);
    white-space: nowrap;
  }
</style>
