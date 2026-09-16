#!/usr/bin/env bun
// Times the REST API of a running rime app: how long it takes to create, read, list and update
// `n` pages.
//
// Usage: bun src/scripts/perf-ops.ts --url http://localhost:5173 [--n 100] [--runs 5]
//          [--email admin@email.com] [--password 'a&1Aa&1A']
//
// Signs in, warms the routes up, then `runs` times over: creates `n` pages, reads each one,
// reads each one again, lists 20 pages `n` times from `n` offsets, lists them again, does both
// reads and lists once more without signing in, and updates each one. Prints the median total of each pass in ms. The "again" passes are where an API cache
// shows: the cache is keyed per operation and parameters, so the first read of a page and the
// first list at an offset miss, the second hit. The last line is `RESULT {json}` for a script to
// pick up.

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((arg, index, all) => (arg.startsWith('--') ? [arg.slice(2), all[index + 1]] : null))
    .filter((pair): pair is [string, string] => pair !== null)
);

const BASE = args.url ?? 'http://localhost:5173';
const N = Number(args.n ?? 100);
const RUNS = Number(args.runs ?? 1);
const EMAIL = args.email ?? 'admin@email.com';
const PASSWORD = args.password ?? 'a&1Aa&1A';
const API = `${BASE}/api`;

const fail = (message: string): never => {
  console.error(`[x] ${message}`);
  process.exit(1);
};

let cookie = '';

const call = async (method: string, path: string, body?: unknown, anonymous = false) => {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', origin: BASE, cookie: anonymous ? '' : cookie },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) fail(`${method} ${path} answered ${response.status}: ${await response.text()}`);
  return response;
};

/** Runs `count` calls one after the other and answers how long the whole pass took, in ms. */
const pass = async (count: number, run: (index: number) => Promise<unknown>) => {
  const start = performance.now();
  for (let index = 0; index < count; index++) await run(index);
  return performance.now() - start;
};

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

// Sign in. The admin exists: the driver posted /api/init before calling this.
const signIn = await call('POST', '/auth/sign-in/email', { email: EMAIL, password: PASSWORD });
cookie = (signIn.headers.get('set-cookie') ?? '').split(';')[0];
if (!cookie) fail('sign-in returned no cookie');

// Warm the routes up on a few pages that are not counted.
for (let index = 0; index < 5; index++) {
  const id = await create(-1 - index);
  await call('GET', `/pages/${id}`);
  await call('GET', '/pages?limit=20');
  await call('PATCH', `/pages/${id}`, { views: 0 });
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

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
  await fetch(`${API}/clear-cache`, { method: 'POST', headers: { origin: BASE, cookie } });
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

const row = (name: string, ms: number) =>
  `${name.padEnd(8)} ${Math.round(ms).toString().padStart(7)} ms`;
console.log(`${N} pages, median of ${RUNS} runs`);
console.log(row('create', result.create));
console.log(row('read', result.read));
console.log(row('read 2', result.readAgain));
console.log(row('list', result.list));
console.log(row('list 2', result.listAgain));
console.log(row('read ~', result.readAnon));
console.log(row('list ~', result.listAnon));
console.log(row('update', result.update));
console.log(`RESULT ${JSON.stringify(result)}`);

export {};
