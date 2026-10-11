import { expect, test } from 'vitest';
import { clientCopy, splitImporters, updateServerImports } from './index.server.js';

test('server imports handle directory imports', () => {
  const content = "import { Posts } from './directory';";
  const splitFiles = new Set(['directory/index.ts']);
  const result = updateServerImports(content, splitFiles, '.');
  expect(result).toContain("from './directory/index.server.js'");
});

test('server imports handle implicit extension file imports', () => {
  const content = "import { Posts } from './posts';";
  const splitFiles = new Set(['posts.ts']);
  const result = updateServerImports(content, splitFiles, '.');
  expect(result).toContain("from './posts.server.js'");
});

test('server imports handle explicit extension file imports', () => {
  const content = "import { Posts } from './posts.js';";
  const splitFiles = new Set(['posts.ts']);
  const result = updateServerImports(content, splitFiles, '.');
  expect(result).toContain("from './posts.server.js'");
});

test('server imports handle mixed imports', () => {
  const content = `import A from './a';
import B from './b.js';
import C from './dir';
import P from 'pkg';`;
  const splitFiles = new Set(['a.ts', 'b.ts', 'dir/index.ts']);
  const result = updateServerImports(content, splitFiles, '.');

  expect(result).toContain("from './a.server.js'");
  expect(result).toContain("from './b.server.js'");
  expect(result).toContain("from './dir/index.server.js'");
  // package import should remain untouched
  expect(result).toContain("from 'pkg'");
});

test('server imports find a split .js file', () => {
  const result = updateServerImports(
    "import { News } from './news.js';",
    new Set(['news.js']),
    '.'
  );
  expect(result).toContain("from './news.server.js'");
});

test('server imports with no matching split files remain unchanged', () => {
  const content = "import { X } from './missing';";
  const splitFiles = new Set();
  const result = updateServerImports(content, splitFiles, '.');
  expect(result).toContain("from './missing'");
  expect(result).not.toContain('.server.js');
});

test('a const shared with a $ property stays in the client copy', () => {
  const code = clientCopy(`
    const slug = 'news';
    export const News = Collection.create(slug, { label: slug, $url: (doc) => '/' + slug + doc.id });
  `);
  expect(code).toContain("const slug = 'news'");
  expect(code).not.toContain('$url');
});

test('a helper read only by a $ property is removed, with what only it read', () => {
  const code = clientCopy(`
    const base = '/news/';
    const toUrl = (doc) => base + doc.id;
    export const News = Collection.create('news', { $url: toUrl });
  `);
  expect(code).not.toContain('toUrl');
  expect(code).not.toContain('base');
});

test('a hook read only by $hooks is removed, even when its function bears its name', () => {
  const code = clientCopy(`
    import { Hooks } from 'rimecms';
    const setHome = Hooks.beforeUpsert(async function setHome(args) { return args; });
    export const Pages = Collection.create('pages', { label: 'Pages', $hooks: { beforeUpsert: [setHome] } });
  `);
  expect(code).not.toContain('setHome');
  expect(code).not.toContain('Hooks');
  expect(code).toContain("label: 'Pages'");
});

test('a helper that calls itself is removed when only a $ property reads it', () => {
  const code = clientCopy(`
    function depth(doc) { return doc.parent ? 1 + depth(doc.parent) : 0; }
    const walk = (doc) => (doc.parent ? walk(doc.parent) : doc);
    export const Pages = Collection.create('pages', { $url: (doc) => walk(doc).id + depth(doc) });
  `);
  expect(code).not.toContain('depth');
  expect(code).not.toContain('walk');
});

test('a helper that calls itself stays when the client copy reads it', () => {
  const code = clientCopy(`
    const walk = (n) => (n > 0 ? walk(n - 1) : n);
    export const Pages = Collection.create('pages', { label: String(walk(2)), $url: (doc) => walk(1) });
  `);
  expect(code).toContain('const walk');
});

test('a $ method and a quoted $ key are removed, with what only they read', () => {
  const code = clientCopy(`
    const SECRET = 'abc';
    export const News = Collection.create('news', {
      label: 'News',
      $url(doc) { return SECRET + doc.id; },
      '$hooks': { beforeCreate: [] }
    });
  `);
  expect(code).not.toContain('$url');
  expect(code).not.toContain('$hooks');
  expect(code).not.toContain('SECRET');
  expect(code).toContain("label: 'News'");
});

test('a .$method() call is stripped from its chain and a .server import removed', () => {
  const code = clientCopy(`
    import { trim } from './trim.server';
    export const title = text('title').$beforeSave(trim).required();
  `);
  expect(code).toContain("text('title').required()");
  expect(code).not.toContain('$beforeSave');
  expect(code).not.toContain('trim');
});

test('a declaration inside a function keeps its name, whatever a $ property reads', () => {
  const code = clientCopy(`
    const format = (doc) => { const id = doc.id; return id; };
    export const News = Collection.create('news', { label: format({ id: 'x' }), $url: ({ id }) => id });
  `);
  expect(code).toContain('const id = doc.id');
});

test('re-exports of a split file point at its server half', () => {
  const result = updateServerImports(
    "export { Pages } from './pages';\nexport * from './news';",
    new Set(['pages.ts', 'news.ts']),
    '.'
  );
  expect(result).toContain("from './pages.server.js'");
  expect(result).toContain("from './news.server.js'");
});

test('a barrel of a split file is split, and so is a barrel of that barrel', () => {
  const splitFiles = new Set(['collections/pages.ts']);
  splitImporters(
    new Map([
      ['index.ts', ['./collections']],
      ['collections/index.ts', ['./pages']],
      ['plain.ts', ['./other']]
    ]),
    splitFiles
  );
  expect([...splitFiles].sort()).toEqual([
    'collections/index.ts',
    'collections/pages.ts',
    'index.ts'
  ]);
});
