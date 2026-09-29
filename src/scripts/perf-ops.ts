#!/usr/bin/env bun
// Times the REST API of a running rime app: how long it takes to create, read, list and update
// `n` pages.
//
// Usage: bun src/scripts/perf-ops.ts --url http://localhost:5173 [--n 100] [--runs 5]
//          [--email admin@email.com] [--password 'a&1Aa&1A'] [--cache]
//
// Signs in, warms the routes up, then `runs` times over: creates `n` pages, reads each one,
// reads each one again, lists 20 pages `n` times from `n` offsets, lists them again, does both
// reads and lists once more without signing in, and updates each one. Prints each pass's median
// total and its time per call: a call creates, reads or updates one page, or lists 20. The
// "again" passes are where an API cache shows, named "(cache)" with --cache: the cache is keyed
// per operation and parameters, so the first read of a page and the first list at an offset miss,
// the second hit. The last line is `RESULT {json}` for a script to pick up.

import { createClient, fail, median, parseArgs, pass, printPasses } from './perf-util.js';

const args = parseArgs();

const BASE = args.url ?? 'http://localhost:5173';
const N = Number(args.n ?? 100);
const RUNS = Number(args.runs ?? 1);
const EMAIL = args.email ?? 'admin@email.com';
const PASSWORD = args.password ?? 'a&1Aa&1A';

const { call, signIn, clearCache } = createClient(BASE);

/** A page, related to the two before it: two junction rows to write and to read back. */
const page = (index: number, related: string[]) => ({
  related,
  title: `Page ${index}`,
  body: `Body of page ${index}`,
  published: index % 2 === 0,
  views: index,
  layout: [
    { type: 'paragraph', text: `First paragraph of ${index}` },
    { type: 'paragraph', text: `Second paragraph of ${index}` }
  ]
});

const create = async (index: number, related: string[] = []) => {
  const response = await call('POST', '/pages', page(index, related));
  const json = (await response.json()) as { doc?: { id: string }; id?: string };
  return json.doc?.id ?? json.id ?? fail('create returned no id');
};

await signIn(EMAIL, PASSWORD);

// Warm the routes up on a few pages that are not counted.
for (let index = 0; index < 5; index++) {
  const id = await create(-1 - index);
  await call('GET', `/pages/${id}`);
  await call('GET', '/pages?limit=20');
  await call('PATCH', `/pages/${id}`, { views: 0 });
}

// Every run creates its own pages and reads and updates those; the collection grows by `n`
// per run, which the list pass sees. A write does not empty the API cache, so each run empties
// it first: a run's first read and list then miss, and only the "again" passes hit.
const totals = {
  create: [] as number[],
  read: [] as number[],
  readAgain: [] as number[],
  list: [] as number[],
  listAgain: [] as number[],
  readAnon: [] as number[],
  listAnon: [] as number[],
  update: [] as number[]
};
for (let run = 0; run < RUNS; run++) {
  await clearCache();
  const ids: string[] = [];
  const at = (index: number) => run * N + index;
  totals.create.push(
    await pass(N, async (index) => ids.push(await create(at(index), ids.slice(-2))))
  );
  totals.read.push(await pass(N, (index) => call('GET', `/pages/${ids[index]}`)));
  totals.readAgain.push(await pass(N, (index) => call('GET', `/pages/${ids[index]}`)));
  totals.list.push(await pass(N, (index) => call('GET', `/pages?limit=20&offset=${index}`)));
  totals.listAgain.push(await pass(N, (index) => call('GET', `/pages?limit=20&offset=${index}`)));
  totals.readAnon.push(
    await pass(N, (index) => call('GET', `/pages/${ids[index]}`, undefined, true))
  );
  totals.listAnon.push(
    await pass(N, (index) => call('GET', `/pages?limit=20&offset=${index}`, undefined, true))
  );
  totals.update.push(
    await pass(N, (index) =>
      call('PATCH', `/pages/${ids[index]}`, { title: `Page ${at(index)} updated`, views: index })
    )
  );
}

const result = {
  n: N,
  runs: RUNS,
  create: median(totals.create),
  read: median(totals.read),
  readAgain: median(totals.readAgain),
  list: median(totals.list),
  listAgain: median(totals.listAgain),
  readAnon: median(totals.readAnon),
  listAnon: median(totals.listAnon),
  update: median(totals.update)
};

// Each pass is `n` calls; a list call reads 20 pages. With --cache the second passes hit the
// API cache, else they only repeat the first.
const again = args.cache ? '(cache)' : 'again';
printPasses(
  [
    ['create', 'POST, 1 page', result.create],
    ['read', 'GET, 1 page', result.read],
    [`read ${again}`, 'GET, 1 page, again', result.readAgain],
    ['read anon', 'GET, 1 page, signed out', result.readAnon],
    ['list', 'GET, 20 pages from an offset', result.list],
    [`list ${again}`, 'GET, 20 pages, again', result.listAgain],
    ['list anon', 'GET, 20 pages, signed out', result.listAnon],
    ['update', 'PATCH, 1 page', result.update]
  ],
  N,
  RUNS
);
console.log(`RESULT ${JSON.stringify(result)}`);

export {};
