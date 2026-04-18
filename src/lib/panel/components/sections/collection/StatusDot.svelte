<script lang="ts">
  import { VERSIONS_STATUS, type VersionsStatus } from '$lib/core/constant.js';

  type Props = { status: VersionsStatus };

  const { status }: Props = $props();
  const colorDraft = 'var(--rz-color-warn)';
  const colorPublished = 'var(--rz-color-success)';
  const color = $derived(status === VERSIONS_STATUS.DRAFT ? colorDraft : colorPublished);
</script>

<div style="--rz-status-color:{color}" class="rz-status__dot"></div>

<style>
  .rz-status__dot {
    flex-shrink: 0;
    width: var(--rz-dot-size, 0.7rem);
    height: var(--rz-dot-size, 0.7rem);
    background-color: hsl(var(--rz-status-color));
    border-radius: 0.7rem;
  }
</style>
