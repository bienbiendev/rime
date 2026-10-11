import { block, blocks } from '#lib/fields/blocks/index.js';
import { checkbox } from '#lib/fields/checkbox/index.js';
import { combobox } from '#lib/fields/combobox/index.js';
import { date } from '#lib/fields/date/index.js';
import { email } from '#lib/fields/email/index.js';
import { group } from '#lib/fields/group/index.js';
import { link } from '#lib/fields/link/index.js';
import { number } from '#lib/fields/number/index.js';
import { radio } from '#lib/fields/radio/index.js';
import { relation } from '#lib/fields/relation/index.js';
import { richText } from '#lib/fields/rich-text/index.js';
import { select } from '#lib/fields/select/index.js';
import { slug } from '#lib/fields/slug/index.js';
import { tab, tabs, type TabsBuilder } from '#lib/fields/tabs/index.js';
import { text } from '#lib/fields/text/index.js';
import { textarea } from '#lib/fields/textarea/index.js';
import { time } from '#lib/fields/time/index.js';
import { toggle } from '#lib/fields/toggle/index.js';
import { tree } from '#lib/fields/tree/index.js';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

/**
 * The defaults each field type carries from the moment it is made, outside any tabs() and with no
 * dev server: what the pipeline and the panel read in production. Presentational fields
 * (separator, tabs, component) hold no value and carry none.
 */

const ctx = {} as any;

describe('text', () => {
  it('rejects a non-string and starts empty', () => {
    expect(text('title').use.validate(5, ctx)).toBe('Should be a string');
    expect(text('title').use.validate('5', ctx)).toBe(true);
    expect(text('title').use.defaultValue()).toBe(null);
    expect(text('title').use.isEmpty('')).toBe(true);
  });
});

describe('textarea', () => {
  it('rejects a non-string', () => {
    expect(textarea('notes').use.validate(5, ctx)).toBe('Should be a string');
    expect(textarea('notes').use.validate('a\nb', ctx)).toBe(true);
  });
});

describe('email', () => {
  it('accepts an address and refuses anything else', () => {
    expect(email('contact').use.validate('a@rime.dev', ctx)).toBe(true);
    expect(email('contact').use.validate('nope', ctx)).not.toBe(true);
  });

  it('accepts a + tag or an apostrophe before the @, and refuses a misplaced dot', () => {
    expect(email('contact').use.validate('ann+news@x.com', ctx)).toBe(true);
    expect(email('contact').use.validate("o'brien@x.io", ctx)).toBe(true);
    expect(email('contact').use.validate('a..b@x.io', ctx)).not.toBe(true);
    expect(email('contact').use.validate('.a@x.io', ctx)).not.toBe(true);
    expect(email('contact').use.validate('a.@x.io', ctx)).not.toBe(true);
  });
});

describe('slug', () => {
  it('accepts lowercase words joined by dashes only', () => {
    expect(slug('slug').use.validate('my-page', ctx)).toBe(true);
    expect(slug('slug').use.validate('My Page', ctx)).not.toBe(true);
    expect(slug('slug').use.isEmpty('')).toBe(true);
  });
});

describe('number', () => {
  it('rejects a non-number, keeps a 0 default, and has no default of its own', () => {
    expect(number('n').use.validate('3', ctx)).toBe('Should be a number');
    expect(number('n').use.validate(3, ctx)).toBe(true);
    expect(number('n').min(-5).defaultValue(0).use.defaultValue()).toBe(0);
    expect(number('n').min(2).use.defaultValue()).toBe(null);
    expect(number('n').use.isEmpty(0)).toBe(false);
  });

  it('reads the string a form sends as a number before validation', async () => {
    expect(await number('n').use.beforeValidate('12', ctx)).toBe(12);
    expect(await number('n').use.beforeValidate('-5', ctx)).toBe(-5);
    expect(await number('n').use.beforeValidate('2.5', ctx)).toBe(2.5);
    expect(await number('n').use.beforeValidate('', ctx)).toBeNull();
    expect(await number('n').use.beforeValidate('abc', ctx)).toBe('abc');
  });
});

describe('checkbox', () => {
  it('is optional in the generated type unless required', () => {
    expect(checkbox('agree').use.generateType()).toBe('agree?: boolean');
    expect(checkbox('agree').required().use.generateType()).toBe('agree: boolean');
  });

  it('rejects a non-boolean, starts unchecked, and false is a value', () => {
    expect(checkbox('agree').use.validate('yes', ctx)).toBe('Should be true/false');
    expect(checkbox('agree').use.validate(false, ctx)).toBe(true);
    expect(checkbox('agree').use.defaultValue()).toBe(false);
    expect(checkbox('agree').use.isEmpty(false)).toBe(false);
  });

  it('reads the string a form sends as a boolean before validation', async () => {
    expect(await checkbox('agree').use.beforeValidate('on', ctx)).toBe(true);
    expect(await checkbox('agree').use.beforeValidate('true', ctx)).toBe(true);
    expect(await checkbox('agree').use.beforeValidate('false', ctx)).toBe(false);
    expect(await checkbox('agree').use.beforeValidate('yes', ctx)).toBe('yes');
  });
});

describe('toggle', () => {
  it('rejects a non-boolean and starts off', () => {
    expect(toggle('on').use.validate(3, ctx)).toBe('Should be true/false');
    expect(toggle('on').use.validate(true, ctx)).toBe(true);
    expect(toggle('on').use.defaultValue()).toBe(false);
  });

  it('reads the string a form sends as a boolean before validation', async () => {
    expect(await toggle('on').use.beforeValidate('true', ctx)).toBe(true);
    expect(await toggle('on').use.beforeValidate('false', ctx)).toBe(false);
  });
});

describe('radio', () => {
  it('starts on its first option, unless told otherwise', () => {
    expect(radio('size').options('s', 'm').use.defaultValue()).toBe('s');
    expect(radio('size').defaultValue('m').options('s', 'm').use.defaultValue()).toBe('m');
    expect(radio('size').options('s', 'm').defaultValue('m').use.defaultValue()).toBe('m');
  });

  it('refuses a value that is not an option', () => {
    expect(radio('size').options('s', 'm').use.validate('xl', ctx)).not.toBe(true);
  });

  it('starts on an option of the list a second options() gives', () => {
    const size = radio('size').options('s', 'm');
    expect(size.clone().options('38', '39').use.defaultValue()).toBe('38');
    expect(size.clone().options('l', 'm').use.defaultValue()).toBe('l');
    const medium = radio('size').options('s', 'm').defaultValue('m');
    expect(medium.clone().options('m', 'l').use.defaultValue()).toBe('m');
  });
});

describe('select', () => {
  it('writes each option as a string literal in the generated type', () => {
    const season = 'season?: ("l\'été" | "hiver")';
    expect(select('season').options("l'été", 'hiver').use.generateType()).toBe(season);
    expect(combobox('season').options("l'été").use.generateType()).toBe(`season?: "l'été"`);
    expect(radio('season').options("l'été").use.generateType()).toBe(`season?: "l'été"`);
  });

  it('refuses a value that is not an option', () => {
    expect(select('kind').options('a', 'b').use.validate('c', ctx)).not.toBe(true);
    expect(select('kind').options('a', 'b').use.validate('a', ctx)).toBe(true);
  });

  it('many: empty with no option picked, and every value checked', () => {
    const tags = select('tags').options('a', 'b').many();
    expect(tags.use.isEmpty([])).toBe(true);
    expect(tags.use.isEmpty(['a'])).toBe(false);
    expect(tags.use.validate(['a', 'x'], ctx)).not.toBe(true);
  });

  it('takes one option as a string, and many as a list of distinct options', () => {
    const kind = select('kind').options('a', 'b');
    expect(kind.use.validate(5, ctx)).not.toBe(true);
    expect(kind.use.validate({}, ctx)).not.toBe(true);
    expect(kind.use.validate(['a'], ctx)).not.toBe(true);

    const tags = select('tags').options('news', 'events').many();
    expect(tags.use.validate(['news', 'news'], ctx)).not.toBe(true);
    expect(tags.use.validate('news', ctx)).not.toBe(true);
    expect(tags.use.validate(['news', 'events'], ctx)).toBe(true);
  });

  it('many: reads the lone option a form sends as a one-item list before validation', async () => {
    const tags = select('tags').options('news', 'events').many();
    expect(await tags.use.beforeValidate('news', ctx)).toEqual(['news']);
    expect(await tags.use.beforeValidate(['news', 'events'], ctx)).toEqual(['news', 'events']);
    expect(await tags.use.beforeValidate('', ctx)).toEqual([]);
    expect(await select('kind').options('a').use.beforeValidate('a', ctx)).toBe('a');
  });
});

describe('combobox', () => {
  it('refuses a value that is not an option', () => {
    expect(combobox('tag').options('x', 'y').use.validate('z', ctx)).not.toBe(true);
    expect(combobox('tag').options('x', 'y').use.validate('x', ctx)).toBe(true);
  });
});

describe('date', () => {
  it('starts on the current date', () => {
    vi.useFakeTimers();
    onTestFinished(() => {
      vi.useRealTimers();
    });
    vi.setSystemTime(new Date('2026-10-04T10:00:00Z'));
    expect(date('published').use.defaultValue()).toEqual(new Date('2026-10-04T10:00:00Z'));
  });

  it('turns the string a form or JSON body sends into a date before validation', async () => {
    const iso = '2026-10-04T10:00:00.000Z';
    const parsed = await date('published').use.beforeValidate(iso, ctx);
    expect(parsed).toBeInstanceOf(Date);
    expect(parsed.toISOString()).toBe(iso);
  });

  it('refuses a string that is not a date', async () => {
    const published = date('published');
    const parsed = await published.use.beforeValidate('soon', ctx);
    expect(published.use.validate(parsed, ctx)).toBe('invalid_date');
    expect(published.use.validate(new Date('2026-10-04T10:00:00Z'), ctx)).toBe(true);
  });

  it('keeps an empty date empty before validation', async () => {
    expect(await date('published').use.beforeValidate(null, ctx)).toBeNull();
    expect(await date('published').use.beforeValidate(undefined, ctx)).toBeUndefined();
  });
});

describe('time', () => {
  it('starts at 08:00 and refuses a time that does not exist', () => {
    expect(time('openAt').use.defaultValue()).toBe('08:00');
    expect(time('openAt').use.validate('09:30', ctx)).toBe(true);
    expect(time('openAt').use.validate('25:00', ctx)).not.toBe(true);
  });

  it('refuses a one-digit hour, which the time input cannot show', () => {
    expect(time('openAt').use.validate('8:00', ctx)).not.toBe(true);
  });
});

describe('link', () => {
  it('has no default of its own, and is empty without a value', () => {
    expect(link('url').use.defaultValue()).toBe(null);
    expect(link('url').use.isEmpty({ type: 'url', value: '' })).toBe(true);
  });

  it('drops a script url on save, and reads a url link back as it is', async () => {
    const url = link('url');
    const saved = await url.use.beforeSave(
      { type: 'url', value: 'https://rime.dev', target: '_self', url: 'javascript:alert(1)' },
      ctx
    );
    expect(saved).toEqual({ type: 'url', value: 'https://rime.dev', target: '_self' });
    const stored = { type: 'url', value: 'https://rime.dev', target: '_self' };
    expect(await url.use.beforeRead(stored, ctx)).toBe(stored);
  });

  it('accepts an http url and refuses a script url', () => {
    const url = link('url');
    expect(url.use.validate({ type: 'url', value: 'https://rime.dev' }, ctx)).toBe(true);
    expect(url.use.validate({ type: 'url', value: 'javascript:alert(1)' }, ctx)).not.toBe(true);
  });

  it('refuses a link of a type the field does not offer', () => {
    const cta = link('cta').types('url', 'pages');
    const script = { type: 'other', value: 'javascript:alert(1)', target: '_self' };
    expect(cta.use.validate(script, ctx)).not.toBe(true);
    expect(cta.use.validate({ type: 'pages', value: 'p1', target: '_self' }, ctx)).toBe(true);
  });

  it('accepts an emptied link as it is stored', async () => {
    const url = link('url');
    const saved = await url.use.beforeSave({ type: 'url', value: '', target: '_self' }, ctx);
    expect(saved.value).toBe(null);
    expect(url.use.validate(saved, ctx)).toBe(true);
  });
});

describe('relation', () => {
  it('starts with no document and is empty without one', () => {
    expect(relation('author').to('staff').use.defaultValue()).toEqual([]);
    expect(relation('author').to('staff').use.isEmpty([])).toBe(true);
    expect(relation('author').to('staff').use.isEmpty(['id'])).toBe(false);
  });
});

describe('richText', () => {
  const doc = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }]
  };

  it('plain text: a string is a value, an empty one is not, and it reads back as is', async () => {
    const body = richText('body');
    expect(body.use.isEmpty('Hello world')).toBe(false);
    expect(body.use.isEmpty('')).toBe(true);
    expect(await body.use.beforeRead('Hello world', ctx)).toBe('Hello world');
  });

  it('JSONContent: a document with text is a value, an empty one is not', () => {
    const body = richText('body');
    expect(body.use.isEmpty(doc)).toBe(false);
    expect(body.use.isEmpty({ type: 'doc', content: [] })).toBe(true);
  });

  it('JSONContent: saved as JSON and read back as the same document', async () => {
    const body = richText('body');
    const saved = await body.use.beforeSave(doc, ctx);
    expect(typeof saved).toBe('string');
    expect(await body.use.beforeRead(saved, ctx)).toEqual(doc);
    // A document the adapter already gives back as an object stays as it is
    expect(await body.use.beforeRead(doc, ctx)).toEqual(doc);
  });

  it('JSONContent: a script href is dropped on save', async () => {
    const linked = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'go', marks: [{ type: 'link', attrs: { href: 'javascript:x' } }] }
          ]
        }
      ]
    };
    const saved = await richText('body').use.beforeSave(linked, ctx);
    expect(JSON.parse(saved).content[0].content[0].marks[0].attrs).toEqual({});
  });
});

describe('group', () => {
  it('is empty with no member set', () => {
    const meta = group('meta').fields(text('title'));
    expect(meta.use.isEmpty({})).toBe(true);
    expect(meta.use.isEmpty({ title: 'a' })).toBe(false);
  });
});

describe('blocks', () => {
  it('starts with no block and is empty without one', () => {
    const sections = blocks('sections', [block('paragraph').fields(text('text'))]);
    expect(sections.use.defaultValue()).toEqual([]);
    expect(sections.use.isEmpty([])).toBe(true);
  });

  it('refuses a block of a type the list does not declare', () => {
    const sections = blocks('sections', [block('hero')]);
    expect(sections.use.validate([{ type: 'nope' }], ctx)).toBe('unknown_block');
    expect(sections.use.validate([{ type: 'hero' }], ctx)).toBe(true);
  });

  it('a localized list leaves a block shared with another list as it is', () => {
    const hero = block('hero').fields(text('title'));
    const plain = blocks('a', [hero]);
    const localized = blocks('b', [hero]).localized();

    expect(hero.get.fields.some((field) => field.name === 'locale')).toBe(false);
    expect(plain.get.blocks[0].get.fields[0].get.localized).toBe(false);
    expect(localized.get.blocks[0].get.fields[0].get.localized).toBe(true);
    expect(localized.get.blocks[0]).not.toBe(hero);
  });
});

describe('tree', () => {
  it('starts with no item and is empty without one', () => {
    const links = tree('links').fields(text('label'));
    expect(links.use.defaultValue()).toEqual([]);
    expect(links.use.isEmpty([])).toBe(true);
  });
});

describe('$beforeDuplicate', () => {
  it('a text, slug or richText title gets its own copy; an email or a date stays as it is', async () => {
    const context = { event: {} as any, slug: 'pages', path: 'title', doc: {} } as any;
    expect(await text('title').isTitle().use.beforeDuplicate('Sale', context)).toBe('Sale (copy)');
    expect(await slug('slug').isTitle().use.beforeDuplicate('sale', context)).toBe('sale-copy');
    expect(await richText('heading').isTitle().use.beforeDuplicate('Sale', context)).toBe(
      'Sale (copy)'
    );
    expect(await email('email').use.beforeDuplicate('a@b.co', context)).toBe('a@b.co');
    const day = new Date('2026-10-04T10:00:00Z');
    expect(await date('day').use.beforeDuplicate(day, context)).toBe(day);
  });

  it('runs an app hook after the field’s own copy', async () => {
    const title = text('title')
      .isTitle()
      .$beforeDuplicate((value) => value.toUpperCase());
    const context = { event: {} as any, slug: 'pages', path: 'title', doc: { title: 'Sale' } };
    expect(await title.use.beforeDuplicate('Sale', context as any)).toBe('SALE (COPY)');
  });

  it('a clone keeps the hooks in their order', async () => {
    const title = text('title')
      .isTitle()
      .$beforeDuplicate((value) => value.toUpperCase())
      .clone();
    const context = { event: {} as any, slug: 'pages', path: 'title', doc: { title: 'Sale' } };
    expect(await title.use.beforeDuplicate('Sale', context as any)).toBe('SALE (COPY)');
  });
});

describe('localized() before fields()', () => {
  const field = (fields: { name: string; get: { localized?: boolean } }[], name: string) =>
    fields.find((candidate) => candidate.name === name)!;

  it('a group localizes the fields it is given after', () => {
    const seo = group('seo').localized().fields(text('title'));
    expect(field(seo.get.fields, 'title').get.localized).toBe(true);
  });

  it('a tree localizes the fields it is given after', () => {
    const nav = tree('nav').localized().fields(text('label'));
    expect(field(nav.get.fields, 'label').get.localized).toBe(true);
  });
});

describe('tab', () => {
  it('reads its name capitalized when it has no label', () => {
    expect(tab('seo').get.label).toBe('Seo');
    expect(tab('seo').label('SEO').get.label).toBe('SEO');
  });
});

describe('a localized container holding tabs', () => {
  const seo = () => tabs(tab('seo').fields(text('title')));
  const titleIn = (field: unknown) => (field as TabsBuilder).get.tabs[0].get.fields[0];

  it('group localizes the field in the tab', () => {
    const meta = group('meta').fields(seo()).localized();
    expect(titleIn(meta.get.fields[0]).get.localized).toBe(true);
  });

  it('blocks localizes the field in the tab', () => {
    const sections = blocks('sections', [block('note').fields(seo())]).localized();
    expect(titleIn(sections.get.blocks[0].block.fields[0]).get.localized).toBe(true);
  });

  it('tree localizes the field in the tab', () => {
    const links = tree('links').fields(seo()).localized();
    const inTabs = links.get.fields.find((field) => field.type === 'tabs');
    expect(titleIn(inTabs).get.localized).toBe(true);
  });
});
