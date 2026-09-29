#!/usr/bin/env bun
// Times the reads that follow relations, on a running rime app with perf-bench's `relations`
// fixture: lists and reads at depth 0, 1 and 2, the menu's links, and a page found by its url.
//
// Usage: bun src/scripts/perf-ops-relations.ts --url http://localhost:5173 [--n 100] [--runs 5]
//          [--email admin@email.com] [--password 'a&1Aa&1A'] [--cache]
//
// Seeds once, then `runs` times over makes `n` calls a pass and prints each pass's median total
// and its time per call. The seed:
//
//   authors      10
//   categories   20, 10 of them under the other 10
//   pages        `n`, 3 levels deep: 5 at the top, 4 under each page above. Each has an author,
//                2 categories, the 2 pages before it as related, and a call to action block
//                linking the page before it. Its url carries its parents' slugs.
//   menu         a tree of 20 links to pages
//
// A list at depth 1 then reads, per page: its author, categories and related pages, its call to
// action's link, its children and its parents' slugs. The last line is `RESULT {json}`.

import { createClient, fail, median, parseArgs, pass, printPasses } from './perf-util.js';

const args = parseArgs();

const BASE = args.url ?? 'http://localhost:5173';
const N = Number(args.n ?? 100);
const RUNS = Number(args.runs ?? 1);
const EMAIL = args.email ?? 'admin@email.com';
const PASSWORD = args.password ?? 'a&1Aa&1A';

const { call, signIn, clearCache } = createClient(BASE);

const create = async (slug: string, data: Record<string, unknown>) => {
  const json = (await (await call('POST', `/${slug}`, data)).json()) as { doc?: { id: string } };
  return json.doc?.id ?? fail(`create ${slug} returned no id`);
};

const get = async (path: string) => (await call('GET', path)).json();

await signIn(EMAIL, PASSWORD);

// Seed
const authors: string[] = [];
for (let index = 0; index < 10; index++) {
  authors.push(await create('authors', { name: `Author ${index}` }));
}

const categories: string[] = [];
for (let index = 0; index < 20; index++) {
  const parent = index < 10 ? undefined : categories[index - 10];
  categories.push(await create('categories', { title: `Category ${index}`, _parent: parent }));
}

// 5 at the top, then 4 under each page before: indexes 5-24 under 0-4, 25-104 under 5-24.
const pages: string[] = [];
for (let index = 0; index < N; index++) {
  const parent = index < 5 ? undefined : pages[Math.floor((index - 5) / 4)];
  const linked = pages[index - 1];
  pages.push(
    await create('pages', {
      title: `Page ${index}`,
      slug: `page-${index}`,
      _parent: parent,
      author: [authors[index % 10]],
      categories: [categories[index % 20], categories[(index + 7) % 20]],
      related: pages.slice(-2),
      layout: [
        { type: 'paragraph', text: `Paragraph of ${index}` },
        {
          type: 'cta',
          label: `Go on from ${index}`,
          link: linked
            ? { type: 'pages', value: linked, target: '_self' }
            : { type: 'url', value: 'https://example.com', target: '_self' }
        }
      ]
    })
  );
}

await call('PATCH', '/menu', {
  nav: Array.from({ length: 20 }, (_, index) => ({
    link: { type: 'pages', value: pages[(index * 5) % N], target: '_self' }
  }))
});

const { docs: listed } = (await get(`/pages?limit=${N}`)) as {
  docs: { id: string; url?: string }[];
};
const urls = pages.map((id) => listed.find((doc) => doc.id === id)?.url ?? '');
if (urls.some((url) => !url)) fail('a page came back without its url');
const { docs: found } = (await get(
  `/pages?where[url][equals]=${encodeURIComponent(urls[N - 1])}`
)) as {
  docs: unknown[];
};
if (found.length !== 1) fail(`a lookup by url found ${found.length} pages instead of 1`);

const passes = {
  listD0: (index: number) => get(`/pages?limit=20&offset=${index}`),
  listD1: (index: number) => get(`/pages?limit=20&offset=${index}&depth=1`),
  listD2: (index: number) => get(`/pages?limit=20&offset=${index}&depth=2`),
  readD1: (index: number) => get(`/pages/${pages[index]}?depth=1`),
  readD2: (index: number) => get(`/pages/${pages[index]}?depth=2`),
  menuD1: () => get('/menu?depth=1'),
  byUrl: (index: number) => get(`/pages?where[url][equals]=${encodeURIComponent(urls[index])}`)
};

// Warm every route up once, uncounted.
for (const run of Object.values(passes)) await run(0);

const totals = Object.fromEntries(
  Object.keys(passes).map((name) => [name, [] as number[]])
) as Record<keyof typeof passes, number[]>;
for (let run = 0; run < RUNS; run++) {
  await clearCache();
  for (const [name, call] of Object.entries(passes) as [
    keyof typeof passes,
    (index: number) => Promise<unknown>
  ][]) {
    totals[name].push(await pass(N, call));
  }
}

const medians = Object.fromEntries(
  Object.entries(totals).map(([name, values]) => [name, median(values)])
) as Record<keyof typeof passes, number>;
const result = { fixture: 'relations', n: N, runs: RUNS, ...medians };

printPasses(
  [
    ['list d0', 'GET, 20 pages from an offset', result.listD0],
    ['list d1', 'GET, 20 pages, depth 1', result.listD1],
    ['list d2', 'GET, 20 pages, depth 2', result.listD2],
    ['read d1', 'GET, 1 page, depth 1', result.readD1],
    ['read d2', 'GET, 1 page, depth 2', result.readD2],
    ['menu d1', 'GET, the menu, 20 links', result.menuD1],
    ['by url', 'GET, where url equals', result.byUrl]
  ],
  N,
  RUNS
);
console.log(`RESULT ${JSON.stringify(result)}`);
