// What a visitor's browser loads without signing in, in a built app: the site's front page holds
// no panel, no config and no auth client; the panel's sign-in pages hold no config and none of
// the signed-in panel.
//
// Run from the app, after a build with source maps on. For each route it starts from the route's
// layouts and page in the client manifest, follows their static imports, and reads each chunk's
// source map for the modules bundled in it:
//
//   node src/scripts/verify-public-chunks.mjs
//   /: 8 chunks, 117 modules
//   /(rime)/[panel=panel]/sign-in: 7 chunks, 180 modules
import fs from 'node:fs';
import path from 'node:path';

const OUT = '.svelte-kit/output/client';
const DIST = String.raw`[/\\]rimecms[/\\]dist[/\\]`;

const CONFIG = [
  { name: 'the config builders', test: new RegExp(`${DIST}core[/\\\\]config[/\\\\]`) },
  { name: "the app's config", test: /[/\\]\+rime\.generated[/\\]/ }
];
const PANEL = [
  { name: 'the panel', test: new RegExp(`${DIST}panel[/\\\\]`) },
  {
    name: "a field's panel component",
    test: new RegExp(`${DIST}fields[/\\\\][^/\\\\]+[/\\\\]component[/\\\\]`)
  },
  { name: 'the auth client', test: /[/\\]@?better-auth[/\\]/ }
];
// The pages of the signed-in panel, and what they are made of
const ADMIN = [
  {
    name: 'a signed-in panel page',
    test: new RegExp(`${DIST}panel[/\\\\]pages[/\\\\](?!auth[/\\\\])`)
  },
  {
    name: 'a signed-in panel section',
    test: new RegExp(`${DIST}panel[/\\\\]components[/\\\\]sections[/\\\\](?!auth[/\\\\])`)
  }
];

const ROUTES = [
  { id: '/', refused: [...CONFIG, ...PANEL] },
  { id: '/(rime)/[panel=panel]/sign-in', refused: [...CONFIG, ...ADMIN] },
  { id: '/(rime)/[panel=panel]/forgot-password', refused: [...CONFIG, ...ADMIN] },
  { id: '/(rime)/[panel=panel]/reset-password', refused: [...CONFIG, ...ADMIN] }
];

const manifest = JSON.parse(fs.readFileSync(path.join(OUT, '.vite/manifest.json'), 'utf-8'));
const app = fs.readFileSync('.svelte-kit/generated/client-optimized/app.js', 'utf-8');

/** `"/(rime)/[panel=panel]/sign-in": [~13,[2],[3]]`: the page's node, then its layouts' */
const nodesOf = (id) => {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = app.match(new RegExp(`"${escaped}": \\[~?(\\d+)(?:,\\[([\\d,]*)\\])?`));
  if (!match) throw new Error(`no route ${id} in the generated client app`);
  const layouts = match[2] ? match[2].split(',').filter(Boolean) : [];
  // The root layout, the route's layouts, then its page
  return [...new Set(['0', ...layouts, match[1]])];
};

/** Every module the chunks of a route bundle, read from their source maps. */
const modulesOf = (id) => {
  const chunks = new Set();
  const visit = (key) => {
    if (chunks.has(key) || !manifest[key]) return;
    chunks.add(key);
    for (const next of manifest[key].imports ?? []) visit(next);
  };
  for (const node of nodesOf(id)) visit(`.svelte-kit/generated/client-optimized/nodes/${node}.js`);

  const modules = [];
  for (const key of chunks) {
    const file = path.join(OUT, manifest[key].file);
    const map = `${file}.map`;
    if (!fs.existsSync(map)) {
      // A chunk of imports alone has no code of its own, and no map
      const code = fs
        .readFileSync(file, 'utf-8')
        .replace(/import\s*(?:[^'"]*?from\s*)?["'][^"']+["'];?/g, '');
      if (!code.trim()) continue;
      throw new Error(`no source map for ${file}: build with source maps on`);
    }
    for (const source of JSON.parse(fs.readFileSync(map, 'utf-8')).sources) {
      modules.push({ chunk: manifest[key].file, file: path.resolve(path.dirname(map), source) });
    }
  }
  return { chunks: chunks.size, modules };
};

const refused = [];
for (const route of ROUTES) {
  const { chunks, modules } = modulesOf(route.id);
  for (const { chunk, file } of modules) {
    const rule = route.refused.find(({ test }) => test.test(file));
    if (rule) {
      refused.push(`${route.id}: ${chunk}: ${path.relative(process.cwd(), file)} (${rule.name})`);
    }
  }
  console.log(`${route.id}: ${chunks} chunks, ${modules.length} modules`);
}

if (refused.length) {
  console.error(`a visitor loads what they must not:\n  ${refused.join('\n  ')}`);
  process.exit(1);
}
