<script lang="ts">
  import { RadioGroup as RadioGroupPrimitive, type WithoutChildrenOrChild } from 'bits-ui';
  import type { Component, Snippet } from 'svelte';

  /** A card: its thumbnail, when it has one, above its label. */
  let {
    ref = $bindable(null),
    class: className,
    thumbnail: Thumbnail,
    children,
    ...restProps
  }: WithoutChildrenOrChild<RadioGroupPrimitive.ItemProps> & {
    thumbnail?: Component;
    children: Snippet;
  } = $props();
</script>

<RadioGroupPrimitive.Item
  bind:ref
  class="rz-radio-card-group-item {className}"
  data-thumbnail={Thumbnail ? '' : null}
  {...restProps}
>
  {#if Thumbnail}
    <span class="rz-radio-card-group-item__frame">
      <Thumbnail />
    </span>
  {/if}
  <span class="rz-radio-card-group-item__label">{@render children()}</span>
</RadioGroupPrimitive.Item>
