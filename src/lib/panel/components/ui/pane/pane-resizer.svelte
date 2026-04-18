<script lang="ts">
  import type { PaneResizerProps } from 'paneforge';
  import { PaneResizer } from 'paneforge';

  const props: PaneResizerProps = $props();
</script>

<PaneResizer {...props}>
  <div class="rz-pane-resizer"></div>
</PaneResizer>

<style>
  .rz-pane-resizer {
    position: absolute;
    z-index: 40;
    top: 0;
    width: var(--rz-size-2);
    translate: calc(-1 * var(--rz-size-1)) 0;
    height: 100vh;
  }
</style>
