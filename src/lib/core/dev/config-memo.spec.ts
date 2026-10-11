import { describe, expect, it } from 'vitest';
import configMemo, { flattenConfig } from './config-memo.server.js';
import { PANEL_ROUTE } from './constants.server.js';
import { tab, tabs } from '#lib/fields/tabs/index.js';
import { text } from '#lib/fields/text/index.js';

describe('configMemo', () => {
  it('is the same for two equal configs, and changes with the config', () => {
    const memo = (slug: string) => configMemo({ collections: [{ slug }] });
    expect(memo('a')).toBe(memo('a'));
    expect(memo('a')).not.toBe(memo('b'));
  });

  it('holds the panel route, which no config field names', () => {
    expect(configMemo({})).toContain(`PANEL_ROUTE:${PANEL_ROUTE}`);
  });

  it('marks a cycle, as a rich text feature holds one, and keeps its siblings', () => {
    const parent: Record<string, unknown> = { name: 'upload' };
    const child = { name: 'rich-text-upload-medias', parent };
    parent.child = child;
    const memo = configMemo({ features: [{ extension: child }] });
    // extension -> parent -> child is the extension again
    expect(memo).toContain('features.0.extension.parent.child:string:circular');
    expect(memo).toContain('features.0.extension.parent.name:string:upload');
    expect(memo).toContain('features.0.extension.name:string:rich-text-upload-medias');
  });

  it('reads a tab through its compile(), since a tab keeps its state private', () => {
    const memo = configMemo({ fields: [tabs(tab('seo').fields(text('title')))] });
    expect(memo).toContain('"name":"seo"');
  });
});

describe('flattenConfig', () => {
  it('keys each leaf by its path', () => {
    expect(flattenConfig({ a: { b: 1 }, list: [2], empty: {} })).toEqual({
      'a.b': 1,
      'list.0': 2,
      empty: {}
    });
  });
});
