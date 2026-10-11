import { separator } from '#lib/fields/separator/index.js';
import { tab, tabs, type TabsBuilder } from '#lib/fields/tabs/index.js';
import { text } from '#lib/fields/text/index.js';
import { describe, expect, it } from 'vitest';
import { localizeFields } from './localize.js';

const seoTitle = (field: unknown) => (field as TabsBuilder).get.tabs[0].get.fields[0];

describe('localizeFields', () => {
  it('a form field and the fields of a tabs become localized clones', () => {
    const [label, seo] = localizeFields([text('label'), tabs(tab('seo').fields(text('title')))]);

    expect(label.get.localized).toBe(true);
    expect(seoTitle(seo).get.localized).toBe(true);
  });

  it('the originals stay as they were', () => {
    const label = text('label');
    const seo = tabs(tab('seo').fields(text('title')));

    const [labelClone, seoClone] = localizeFields([label, seo]);

    expect(labelClone).not.toBe(label);
    expect(seoClone).not.toBe(seo);
    expect(label.get.localized).toBe(false);
    expect(seoTitle(seo).get.localized).toBe(false);
  });

  it('a kept member stays as it is', () => {
    const path = text('path');
    const [kept] = localizeFields([path], ['path']);

    expect(kept).toBe(path);
    expect(kept.get.localized).toBe(false);
  });

  it('a separator stays as it is', () => {
    const line = separator();
    const [kept] = localizeFields([line]);

    expect(kept).toBe(line);
  });
});
