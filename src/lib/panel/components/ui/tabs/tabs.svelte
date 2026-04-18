<script lang="ts">
  import { Tabs as TabsPrimitive, type TabsRootProps } from 'bits-ui';
  import './tabs.css';

  type Props = TabsRootProps;
  const { children, class: className, ...restProps }: Props = $props();
</script>

<TabsPrimitive.Root class="rz-tabs {className}" {...restProps}>
  {@render children?.()}
</TabsPrimitive.Root>
