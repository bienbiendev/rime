<script lang="ts">
  import { Dialog as SheetPrimitive, type DialogRootProps } from 'bits-ui';
  import './sheet.css';
  type Props = DialogRootProps;
  let { children, open = $bindable(), ...restProps }: Props = $props();
</script>

<SheetPrimitive.Root bind:open {...restProps}>
  {@render children?.()}
</SheetPrimitive.Root>
