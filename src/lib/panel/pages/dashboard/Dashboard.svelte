<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import type { User } from '$lib/core/collections/auth/types.js';
  import { t__ } from '$lib/core/i18n/index.js';
  import Page from '$lib/panel/components/sections/page-layout/Page.svelte';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import LanguageSwitcher from '$lib/panel/components/ui/language-switcher/LanguageSwitcher.svelte';
  import PageHeader from '$lib/panel/components/ui/page-header/PageHeader.svelte';
  import { getConfigContext } from '$lib/panel/context/config.svelte.js';
  import { Eye } from '@lucide/svelte';
  import DashboardCollection from './DashboardCollection.svelte';
  import type { DashboardEntry } from './types.js';

  type Props = { entries: DashboardEntry[]; user?: User };
  const { entries, user }: Props = $props();

  const config = getConfigContext();
</script>

<Page>
  {#snippet main()}
    <div class="rz-dashboard">
      <PageHeader>
        {#snippet title()}
          {t__('common.welcome')} {user!.name}
        {/snippet}

        {#snippet topRight()}
          {#if config.raw.siteUrl}
            <Button variant="text" target="_blank" icon={Eye} href={config.raw.siteUrl}>
              {t__('common.view_site')}
            </Button>
          {/if}
          {#each config.raw.panel.components.header as CustomHeaderComponent, index (index)}
            <CustomHeaderComponent />
          {/each}

          <LanguageSwitcher onLocalClick={() => invalidateAll()} />
        {/snippet}
      </PageHeader>

      {#if config.raw.panel.components.dashboard}
        {@const CustomDashBoard = config.raw.panel.components.dashboard}
        <CustomDashBoard {entries} />
      {:else}
        <div class="rz-dashboard__content">
          <div class="rz-dashboard__collections">
            {#each entries.filter((e) => e.prototype === 'collection') as entry, index (index)}
              <DashboardCollection {entry} />
            {/each}
          </div>
          <div class="rz-dashboard__areas">
            {#each entries.filter((e) => e.prototype === 'area') as entry, index (index)}
              {@const Icon = config.raw.icons[entry.slug]}
              <a class="rz-dashboard__area" href={entry.link}>
                <div class="rz-dashboard__area-icon">
                  <Icon size="16" strokeWidth="1" />
                </div>
                <div>
                  <header>
                    <h2>{entry.title}</h2>
                  </header>
                  {#if entry.description}
                    <p class="rz-dashboard__area-description">{entry.description}</p>
                  {/if}
                </div>
              </a>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/snippet}
</Page>

<style type="postcss">
  @import '../../style/mixins/index.css';

  .rz-dashboard {
    background-color: hsl(var(--rz-color-bg));
    min-height: 100vh;

    h2 {
      font-size: var(--rz-text-lg);
      @mixin font-medium;
    }
  }

  .rz-dashboard__collections {
    grid-column: span 2;
    display: grid;
    gap: var(--rz-size-6);
  }

  .rz-dashboard__areas {
    grid-column: span 1;
    gap: var(--rz-size-4);
    display: flex;
    flex-direction: column;
  }

  .rz-dashboard__area {
    background-color: light-dark(hsl(var(--rz-gray-18)), hsl(var(--rz-gray-3)));
    border: var(--rz-border);
    border-radius: var(--rz-radius-xl);
    padding: var(--rz-size-4);
    position: relative;
    min-height: 130px;
    display: flex;
    flex-direction: column;
    gap: var(--rz-size-4);
    transition: background-color 0.3s ease-out;

    &:hover {
      background-color: light-dark(hsl(var(--rz-gray-19)), hsl(var(--rz-gray-4)));
    }

    :global(svg) {
      opacity: 0.7;
      z-index: 0;
    }

    header {
      display: flex;
      align-items: center;
      gap: var(--rz-size-2);
    }
  }
  .rz-dashboard__area-icon {
    width: var(--rz-size-8);
    height: var(--rz-size-8);
    background-color: light-dark(hsl(var(--rz-gray-16)), hsl(var(--rz-gray-0)));
    border-radius: var(--rz-size-10);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .rz-dashboard__area-description {
    opacity: 0.5;
    margin-top: var(--rz-size-1);
  }

  .rz-dashboard__content {
    display: grid;
    gap: var(--rz-size-16);
    padding: var(--rz-size-8) var(--rz-page-gutter);
    height: 100%;
    grid-template-columns: repeat(1, minmax(0, 1fr));
    @media (min-width: 1024px) {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
</style>
