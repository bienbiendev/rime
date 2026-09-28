<script lang="ts">
  import { Toaster } from '$lib/panel/components/ui/sonner';
  import type { Snippet } from 'svelte';

  type Props = {
    children: Snippet;
    title: string;
    image: string | null;
  };
  const { image, children, title }: Props = $props();
</script>

<Toaster />
<div
  class="rz-auth"
  class:rz-auth--image={!!image}
  style={image ? `background-image:url(${image})` : null}
>
  <div class="rz-auth__left"></div>
  <div class="rz-auth__right">
    <div>
      <h1>{title}</h1>
      {@render children()}
    </div>
  </div>
</div>

<style type="postcss">
  @import '../../../style/mixins/index.css';

  .rz-auth {
    display: grid;
    grid-template-columns: 1fr;
    height: 100vh;
    width: 100vw;
    background-size: cover;
    background-position:
      0px 0px,
      0px 0px,
      0px 0px,
      0px 0px;
    background-color: var(--rz-bg-base);
    background-image:
      url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence baseFrequency='10.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.12'/%3E%3C/svg%3E"),
      radial-gradient(113% 91% at 17% -2%, var(--rz-accent-tint) 1%, transparent 99%),
      radial-gradient(142% 91% at 83% 7%, var(--rz-bg-page) 1%, transparent 99%),
      radial-gradient(142% 91% at 111% 84%, var(--rz-bg-active) 0%, transparent 100%);

    @media (min-width: 1024px) {
      grid-template-columns: 0.8fr 1.2fr;
    }

    .rz-auth__right {
      --rz-input-height: var(--rz-size-14);
      border-radius: var(--rz-radius-xl);
      @mixin surface raised;

      @media (min-width: 1024px) {
        margin: 1rem;
      }

      > div {
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        width: 100%;
        gap: var(--rz-size-4);
        margin-bottom: 10vh;
        padding: var(--rz-size-12);
        @media (min-width: 768px) {
          padding: var(--rz-size-20);
        }
        @media (min-width: 1024px) {
          width: min(500px, 90%);
        }
      }

      h1 {
        font-size: clamp(var(--rz-text-3xl), 2.5vw, var(--rz-text-5xl));
        line-height: 1;
        @mixin font-semibold;
      }
      :global(form) {
        flex-direction: column;
        display: flex;
        flex-direction: column;
        justify-content: center;
        width: 100%;
        gap: var(--rz-size-4);
      }
    }
  }

  .rz-auth__left {
    display: none;
    @media (min-width: 1024px) {
      display: block;
    }
  }

  .rz-auth.rz-auth--image {
    background-size: cover;
  }
</style>
