<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import type { User } from '$lib/core/auth/types.js';
  import { t__ } from '$lib/core/i18n/index.js';
  import When from '$lib/panel/components/sections/collection/When.svelte';
  import Page from '$lib/panel/components/sections/page-layout/Page.svelte';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import LanguageSwitcher from '$lib/panel/components/ui/language-switcher/LanguageSwitcher.svelte';
  import PageHeader from '$lib/panel/components/ui/page-header/PageHeader.svelte';
  import { getConfigContext } from '$lib/panel/context/config.svelte.js';
  import { Eye } from '@lucide/svelte';
  import DashboardCard from './DashboardCard.svelte';
  import DashboardCollection from './DashboardCollection.svelte';
  import DashboardRow from './DashboardRow.svelte';
  import { formatDay, greetingKey } from './time.js';
  import type { DashboardEntry } from './types.js';

  type CollectionEntry = Extract<DashboardEntry, { prototype: 'collection' }>;
  type AreaEntry = Extract<DashboardEntry, { prototype: 'area' }>;

  type Props = { entries: DashboardEntry[]; user?: User };
  const { entries, user }: Props = $props();

  const config = getConfigContext();
  const language = $derived(config.raw.panel.language);
  const CustomDashBoard = $derived(config.raw.panel.components.dashboard);

  const now = new Date();
  const firstName = $derived(user?.name.split(' ')[0] ?? '');

  const collections = $derived(
    entries.filter((e): e is CollectionEntry => e.prototype === 'collection')
  );
  const areas = $derived(entries.filter((e): e is AreaEntry => e.prototype === 'area'));
  const areasIcon = $derived(
    config.raw.panel.navigation.groups.find((group) => group.label === 'areas')?.icon
  );

  // The content on the left; the site's areas and its people on the right.
  const isPeople = (entry: CollectionEntry) => !!config.getCollection(entry.slug).auth;
  const contents = $derived(collections.filter((entry) => !isPeople(entry)));
  const people = $derived(collections.filter(isPeople));
  const hasSide = $derived(areas.length > 0 || people.length > 0);

  // Saturday, September 26 · 3 drafts waiting
  const metaLine = $derived.by(() => {
    const drafts = collections.reduce((sum, entry) => sum + (entry.drafts ?? 0), 0);
    const day = formatDay(now, language);
    if (!drafts) return day;
    const key = drafts === 1 ? 'common.drafts_waiting' : 'common.drafts_waiting|m|p';
    return `${day} · ${t__(key, String(drafts))}`;
  });
</script>

<Page>
  {#snippet main()}
    <div class="rz-dashboard">
      <PageHeader>
        {#snippet topRight()}
          {#if config.raw.siteUrl}
            <Button variant="ghost" size="sm" target="_blank" icon={Eye} href={config.raw.siteUrl}>
              {t__('common.view_site')}
            </Button>
          {/if}
          {#each config.raw.panel.components.header as CustomHeaderComponent, index (index)}
            <CustomHeaderComponent />
          {/each}

          <LanguageSwitcher onLocalClick={() => invalidateAll()} />
        {/snippet}
      </PageHeader>

      <div class="rz-dashboard__body">
        <header class="rz-dashboard__head">
          <h1 class="rz-dashboard__title">{t__(greetingKey(now.getHours()), firstName)}</h1>
          <p class="rz-dashboard__meta">{metaLine}</p>
        </header>

        {#if !CustomDashBoard}
          <div
            class="rz-dashboard__content"
            class:rz-dashboard__content--split={contents.length > 0 && hasSide}
          >
            {#if contents.length}
              <div class="rz-dashboard__collections">
                {#each contents as entry (entry.slug)}
                  <DashboardCollection {entry} {now} />
                {/each}
              </div>
            {/if}

            {#if hasSide}
              <div class="rz-dashboard__areas">
                {#if areas.length}
                  <DashboardCard title={t__('common.areas')} icon={areasIcon}>
                    <ul>
                      {#each areas as entry (entry.slug)}
                        <DashboardRow
                          href={entry.link}
                          title={entry.title}
                          icon={config.raw.icons[entry.slug]}
                          description={entry.description}
                        >
                          {#if entry.updatedAt}
                            <When date={entry.updatedAt} {now} />
                          {/if}
                        </DashboardRow>
                      {/each}
                    </ul>
                  </DashboardCard>
                {/if}
                {#each people as entry (entry.slug)}
                  <DashboardCollection {entry} {now} />
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>

      {#if CustomDashBoard}
        <CustomDashBoard {entries} />
      {/if}
    </div>
  {/snippet}
</Page>

<style type="postcss">
  @import '../../style/mixins/index.css';

  .rz-dashboard {
    background-color: var(--rz-bg-page);
    min-height: 100vh;
  }

  /* The full width, inside the page's gutter. */
  .rz-dashboard__body {
    container: rz-dashboard / inline-size;
    display: flex;
    flex-direction: column;
    gap: var(--rz-size-5);
    padding: var(--rz-size-4) var(--rz-page-gutter) var(--rz-size-6);
  }

  .rz-dashboard__head {
    display: flex;
    flex-direction: column;
    gap: var(--rz-size-1-5);
  }

  .rz-dashboard__title {
    font-size: var(--rz-text-4xl);
    @mixin font-semibold;
    letter-spacing: -0.03em;
    line-height: 1.15;
  }

  .rz-dashboard__meta {
    color: var(--rz-fg-subtle);
  }

  .rz-dashboard__content {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--rz-size-3-5);
    align-items: start;
    padding-bottom: var(--rz-size-14);
  }

  /* Collections on the left, areas on the right, once there is room for both. */
  @container rz-dashboard (min-width: 44rem) {
    .rz-dashboard__content--split {
      grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    }
  }

  .rz-dashboard__collections,
  .rz-dashboard__areas {
    display: flex;
    flex-direction: column;
    gap: var(--rz-size-3-5);
    min-width: 0;
  }
</style>
