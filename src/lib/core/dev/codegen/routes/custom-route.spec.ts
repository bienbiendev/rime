import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { customRoute } from './common.server.js';

// A component compiled in dev mode, as Svelte marks it: its file under its own Symbol('filename')
const Stats = { [Symbol('filename')]: 'src/+rime/Stats.svelte' } as never;

const fromDir = path.resolve(process.cwd(), 'src/routes/(rime)/[panel=panel]/stats');

describe('customRoute', () => {
  it('imports an imported component from its file', () => {
    const page = customRoute({ label: 'Stats', component: Stats }, fromDir);
    expect(page).toMatch(/import Page from '[^']*\+rime\/Stats\.svelte'/);
    expect(page).toContain('<Page {data} />');
  });

  it('imports a component named by its path', () => {
    const page = customRoute({ label: 'Stats', component: 'src/+rime/Stats.svelte' }, fromDir);
    expect(page).toMatch(/import Page from '[^']*\+rime\/Stats\.svelte'/);
  });

  it('imports by the exact relative path', () => {
    const page = customRoute({ label: 'Stats', component: Stats }, fromDir);
    expect(page).toContain("import Page from '../../../../+rime/Stats.svelte'");
  });

  it('imports a lowercase file', () => {
    const page = customRoute({ label: 'Stats', component: 'src/+rime/stats-page.svelte' }, fromDir);
    expect(page).toContain("'../../../../+rime/stats-page.svelte'");
  });

  it('imports a package component through a relative path', () => {
    const Pkg = { [Symbol('filename')]: 'node_modules/@acme/stats/dist/Stats.svelte' } as never;
    const page = customRoute({ label: 'Stats', component: Pkg }, fromDir);
    expect(page).toContain("'../../../../../node_modules/@acme/stats/dist/Stats.svelte'");
  });

  it("imports a pnpm package component through the project's node_modules, not its store folder", () => {
    const Pkg = {
      [Symbol('filename')]: path.resolve(
        process.cwd(),
        'node_modules/.pnpm/@acme+stats@1.0.0/node_modules/@acme/stats/dist/Stats.svelte'
      )
    } as never;
    const page = customRoute({ label: 'Stats', component: Pkg }, fromDir);
    expect(page).toContain(
      "import Page from '../../../../../node_modules/@acme/stats/dist/Stats.svelte'"
    );
  });
});
