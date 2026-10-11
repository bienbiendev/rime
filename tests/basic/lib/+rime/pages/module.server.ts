import { SITE_URL } from '$app/env/public';
import { Hooks } from '$rime/config';
import { RimeError, RimeFormError } from '#lib/core/errors/index.js';
import { error } from '@sveltejs/kit';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Written on every page read; api.test.ts reads it to prove the hooks run
const PROBE_FILE = path.resolve(process.cwd(), 'test-results', 'probe-hook.txt');

/** errors.test.ts asks for an error with `?throw=<kind>` and checks how each one comes back. */
const throwOnDemand = (url?: URL) => {
  switch (url?.searchParams.get('throw')) {
    case 'unknown':
      throw new Error('probe: unknown error');
    case 'http':
      throw error(418, 'probe: http error');
    case 'rime':
      throw new RimeError(RimeError.NOT_FOUND, 'probe: rime error');
    case 'form':
      throw new RimeFormError({ 'attributes.title': RimeFormError.INVALID_FIELD });
  }
};

const throwOnCreate = Hooks.beforeCreate<'pages'>(async (args) => {
  throwOnDemand(args.event?.url);
  return args;
});

const throwOnRead = Hooks.beforeRead<'pages'>(async (args) => {
  throwOnDemand(args.event?.url);
  return args;
});

const HOME_SLUG = 'home';

/**
 * The page marked `isHome` is at the root. The pages under the root page `home` leave that first
 * segment out: `home/about-us` → `/about-us`. Every other page is at its path.
 */
export const buildPagesUrl = ({
  path,
  doc
}: {
  path: string[];
  doc: { attributes: { isHome?: boolean } };
}) => {
  if (doc.attributes.isHome) {
    return `${SITE_URL}/`;
  }
  const underHome = path.length > 1 && path[0] === HOME_SLUG;
  return `${SITE_URL}/${(underHome ? path.slice(1) : path).join('/')}`;
};

const clearCacheAfterUpsert = Hooks.afterUpsert<'pages'>(
  async function clearCacheAfterUpsert(args) {
    args.event.locals.rime.cache.clear();
    return args;
  }
);

const clearCacheAfterDelete = Hooks.afterDelete<'pages'>(
  async function clearCacheAfterDelete(args) {
    args.event.locals.rime.cache.clear();
    return args;
  }
);

/** When a save marks a page as home, the other pages marked home lose the mark. */
const setHome = Hooks.beforeUpsert<'pages'>(async function setHome(args) {
  const { data, event, context } = args;
  if (!data?.attributes?.isHome) return args;

  const pages = event.locals.rime.collection('pages');
  const homes = await pages.find({ query: `where[attributes.isHome][equals]=true` });
  for (const page of homes.filter((page) => page.id !== context.params.id)) {
    await pages.updateById({ id: page.id, data: { attributes: { isHome: false } } });
  }
  return args;
});

export const hooks = {
  afterCreate: [clearCacheAfterUpsert],
  afterUpdate: [clearCacheAfterUpsert],
  afterDelete: [clearCacheAfterDelete],
  beforeCreate: [setHome, throwOnCreate],
  beforeUpdate: [setHome],
  beforeRead: [
    Hooks.beforeRead(async (args) => {
      mkdirSync(path.dirname(PROBE_FILE), { recursive: true });
      writeFileSync(PROBE_FILE, 'pages beforeRead');
      return args;
    }),
    throwOnRead
  ]
};
