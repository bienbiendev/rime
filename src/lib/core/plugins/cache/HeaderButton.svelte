<script>
  import DatabaseZapIcon from '@lucide/svelte/icons/database-zap';
  import { t__ } from '#lib/core/i18n/index.js';
  import Button from '#lib/panel/components/ui/button/button.svelte';
  import { toast } from 'svelte-sonner';

  /** Empties the server cache, and says whether it worked. */
  const clearCache = async () => {
    try {
      const res = await fetch('/api/clear-cache', { method: 'post' });
      if (!res.ok) throw new Error(`clear-cache answered ${res.status}`);
      toast.success(t__('common.cache_cleared'));
    } catch {
      toast.error(t__('common.cache_clear_failed'));
    }
  };
</script>

<Button
  variant="ghost"
  size="icon"
  icon={DatabaseZapIcon}
  aria-label={t__('common.clear_cache')}
  onclick={clearCache}
></Button>
