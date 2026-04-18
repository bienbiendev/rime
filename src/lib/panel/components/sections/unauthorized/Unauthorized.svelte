<script>
  import { Ban } from '@lucide/svelte';
  import { t__ } from '$lib/core/i18n/index.js';
</script>

<div class="rz-unauthorized">
  <Ban />
  <p>{t__('errors.unauthorized')}</p>
</div>

<style type="postcss">
  .rz-unauthorized {
    display: flex;
    flex-direction: column;
    height: 100vh;
    justify-content: center;
    align-items: center;
    gap: var(--rz-size-3);
    padding-bottom: 15vh;
    p {
      max-width: 300px;
      text-align: center;
    }
  }
  .rz-unauthorized p {
    @mixin font-semibold;
    font-size: var(--rz-text-lg);
  }
</style>
