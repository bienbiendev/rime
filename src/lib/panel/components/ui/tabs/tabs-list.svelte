<script lang="ts">
  import { Tabs as TabsPrimitive } from 'bits-ui';

  let { ref = $bindable(null), class: className, ...restProps }: TabsPrimitive.ListProps = $props();
</script>

<TabsPrimitive.List bind:ref class="rz-tabs-list {className}" {...restProps} />
