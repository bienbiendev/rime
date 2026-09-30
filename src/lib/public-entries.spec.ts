import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * What a visitor's browser loads without signing in never reaches the config, and a site page
 * never reaches the panel either. Every module an entry imports, all the way down, is checked.
 *
 * ```
 * rimecms/public         src/lib/public.ts         a site page
 * rimecms/util           src/lib/util/index.ts     a site page
 * rimecms/panel/public   src/lib/panel/public.ts   sign-in, forgot and reset password
 * ```
 *
 * Only runtime imports count: `import type` brings no code. Packages are not refused.
 */
const LIB = path.resolve('src/lib');
const under = (...segments: string[]) => path.join(LIB, ...segments) + path.sep;

type Rule = { name: string; test: (file: string) => boolean };

const CONFIG: Rule[] = [
  { name: 'the config builders', test: (file) => file.startsWith(under('core', 'config')) }
];
const PANEL: Rule[] = [
  { name: 'the panel', test: (file) => file.startsWith(under('panel')) },
  {
    name: "a field's panel component",
    test: (file) => /[/\\]fields[/\\][^/\\]+[/\\]component[/\\]/.test(file)
  }
];
// The pages of the signed-in panel, and what they are made of
const ADMIN: Rule[] = [
  {
    name: 'a signed-in panel page',
    test: (file) =>
      file.startsWith(under('panel', 'pages')) && !file.startsWith(under('panel', 'pages', 'auth'))
  },
  {
    name: 'a signed-in panel section',
    test: (file) =>
      file.startsWith(under('panel', 'components', 'sections')) &&
      !file.startsWith(under('panel', 'components', 'sections', 'auth'))
  }
];

const ENTRIES: { file: string; refused: Rule[] }[] = [
  { file: 'public.ts', refused: [...CONFIG, ...PANEL] },
  { file: 'util/index.ts', refused: [...CONFIG, ...PANEL] },
  { file: 'panel/public.ts', refused: [...CONFIG, ...ADMIN] }
];

// The app's own config, generated from its `src/+rime`
const REFUSED_SPECIFIERS = [
  { name: "the app's config", test: (specifier: string) => specifier === '$rime/config' },
  { name: "the app's config", test: (specifier: string) => specifier.includes('+rime.generated') }
];

const EXTENSIONS = ['', '.ts', '.js', '.svelte', '.svelte.ts', '/index.ts', '/index.js'];

/** A specifier as the bundler reads it, to a file of the library; anything else answers null. */
const resolve = (specifier: string, from: string) => {
  let base: string;
  // The client half of an isomorphic module
  if (specifier.startsWith('$rime/modules:')) {
    base = path.join(LIB, specifier.slice('$rime/modules:'.length), 'module');
  } else if (specifier.startsWith('$lib/')) base = path.join(LIB, specifier.slice(5));
  else if (specifier.startsWith('.')) base = path.resolve(path.dirname(from), specifier);
  else return null;

  const bases = [base, base.replace(/\.js$/, '')];
  for (const candidate of bases.flatMap((b) => EXTENSIONS.map((ext) => b + ext))) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
};

/** The runtime imports of a file: static, and dynamic unless `dynamic` is off. */
const importsOf = (file: string, dynamic: boolean) => {
  const source = fs.readFileSync(file, 'utf8');
  const statement =
    /(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/g;
  const call = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
  const specifiers: string[] = [];
  for (const match of source.matchAll(statement)) if (!match[1]) specifiers.push(match[2]);
  if (dynamic) for (const match of source.matchAll(call)) specifiers.push(match[1]);
  return specifiers;
};

/** `public.ts -> live/Provider.svelte -> panel/util/populate.ts` */
const chainOf = (file: string, importer: Map<string, string | null>) => {
  const chain: string[] = [];
  for (let at: string | null | undefined = file; at; at = importer.get(at)) {
    chain.unshift(path.relative(LIB, at));
  }
  return chain.join(' -> ');
};

/**
 * Each refused module an entry reaches, with the chain of imports that reaches it. With `dynamic`
 * off, only what evaluates with the entry: its static imports, all the way down.
 */
const refusedFrom = (
  entry: string,
  rules: Rule[],
  { specifiers = REFUSED_SPECIFIERS, dynamic = true } = {}
) => {
  const importer = new Map<string, string | null>([[entry, null]]);
  const refused: string[] = [];
  const queue = [entry];
  for (const file of queue) {
    for (const specifier of importsOf(file, dynamic)) {
      const specifierRule = specifiers.find((rule) => rule.test(specifier));
      if (specifierRule) {
        refused.push(`${chainOf(file, importer)} -> ${specifier} (${specifierRule.name})`);
        continue;
      }
      const target = resolve(specifier, file);
      if (!target || importer.has(target)) continue;
      importer.set(target, file);
      const fileRule = rules.find((rule) => rule.test(target));
      if (fileRule) refused.push(`${chainOf(target, importer)} (${fileRule.name})`);
      else queue.push(target);
    }
  }
  return refused;
};

describe('a visitor never loads the config, nor a panel it cannot open', () => {
  for (const { file, refused } of ENTRIES) {
    it(file, () => {
      expect(refusedFrom(path.join(LIB, file), refused)).toEqual([]);
    });
  }
});

// `$env/dynamic/*` reads the SvelteKit page it runs in the moment it evaluates
const KIT_PAGE = [
  {
    name: 'the env of a SvelteKit page',
    test: (specifier: string) => specifier.startsWith('$env/dynamic/')
  }
];

describe('a site page imports rimecms/public outside SvelteKit, in a component spec', () => {
  it('public.ts', () => {
    const refused = refusedFrom(path.join(LIB, 'public.ts'), [], {
      specifiers: KIT_PAGE,
      dynamic: false
    });
    expect(refused).toEqual([]);
  });
});
