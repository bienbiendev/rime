// What perf-ops.ts and perf-ops-relations.ts share: their arguments, a signed-in client, a timed
// pass, the median, and the table they print.

/** `--name value` pairs, and `--flag` alone as `'true'`. */
export const parseArgs = (): Record<string, string> => {
  const argv = process.argv.slice(2);
  const args: Record<string, string> = {};
  argv.forEach((arg, index) => {
    if (!arg.startsWith('--')) return;
    const next = argv[index + 1];
    args[arg.slice(2)] = next === undefined || next.startsWith('--') ? 'true' : next;
  });
  return args;
};

export const fail = (message: string): never => {
  console.error(`[x] ${message}`);
  process.exit(1);
};

/** Calls the REST API as the admin, or signed out. */
export const createClient = (base: string) => {
  const api = `${base}/api`;
  let cookie = '';

  const call = async (method: string, path: string, body?: unknown, anonymous = false) => {
    const response = await fetch(`${api}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        origin: base,
        cookie: anonymous ? '' : cookie
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (!response.ok)
      fail(`${method} ${path} answered ${response.status}: ${await response.text()}`);
    return response;
  };

  // The admin exists: the driver posted /api/init before calling this.
  const signIn = async (email: string, password: string) => {
    const response = await call('POST', '/auth/sign-in/email', { email, password });
    cookie = (response.headers.get('set-cookie') ?? '').split(';')[0];
    if (!cookie) fail('sign-in returned no cookie');
  };

  const clearCache = () =>
    fetch(`${api}/clear-cache`, { method: 'POST', headers: { origin: base, cookie } });

  return { call, signIn, clearCache };
};

/** Runs `count` calls one after the other and answers how long the whole pass took, in ms. */
export const pass = async (count: number, run: (index: number) => Promise<unknown>) => {
  const start = performance.now();
  for (let index = 0; index < count; index++) await run(index);
  return performance.now() - start;
};

export const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** One line per pass: its name, what one call does, the total and the time per call. */
export const printPasses = (rows: [string, string, number][], n: number, runs: number) => {
  const ms = (value: number, digits = 0) => `${value.toFixed(digits)} ms`;
  console.log(
    `${n} calls per pass, median of ${runs} runs`.padEnd(46) +
      'total'.padStart(10) +
      'per call'.padStart(11)
  );
  for (const [name, call, total] of rows) {
    console.log(
      name.padEnd(14) + call.padEnd(32) + ms(total).padStart(10) + ms(total / n, 1).padStart(11)
    );
  }
};
