import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { VERSIONS_STATUS } from '../prototype/shared/versions/constant.js';
import { MEDIA_KINDS } from '../../panel/util/upload-file.js';
import enCommon from './en/common.js';
import enErrors from './en/errors.js';
import enFields from './en/fields.js';
import enMail from './en/mail.js';
import frCommon from './fr/common.js';
import frErrors from './fr/errors.js';
import frFields from './fr/fields.js';
import frMail from './fr/mail.js';
import { namespaces } from './index.js';

const dictionaries: Record<string, Record<string, Record<string, unknown>>> = {
  en: { common: enCommon, errors: enErrors, fields: enFields, mail: enMail },
  fr: { common: frCommon, errors: frErrors, fields: frFields, mail: frMail }
};

const LIB = path.resolve(import.meta.dirname, '../..');

const sources = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(file);
    return /\.(ts|svelte)$/.test(entry.name) && !/\.spec\.ts$/.test(entry.name) ? [file] : [];
  });

// Every literal key, in any quote, across lines, with its `|m|p` modifiers left out:
// t__(`common.save`) -> 'common.save', t__('fields.blocks_count|m|p', …) -> 'fields.blocks_count'
const keysOf = (file: string) =>
  [
    ...fs
      .readFileSync(file, 'utf8')
      .matchAll(/t__\(\s*(['"`])([a-z_]+\.[a-zA-Z0-9_]+)(?:\|[mfp|]*)?\1/g)
  ].map((match) => match[2]);

// Keys built at runtime, each family written out
const RUNTIME_KEYS = [
  ...Object.values(VERSIONS_STATUS).flatMap((status) => [
    `common.${status}`,
    `common.${status}_infos`
  ]),
  ...MEDIA_KINDS.map((kind) => `common.media_kind_${kind}`),
  ...['url', 'email', 'tel', 'anchor'].map((type) => `fields.link_${type}`)
];

// Keys of another namespace belong to an app, as in the createI18n example: t__('site.hello')
const keys = [...new Set([...sources(LIB).flatMap(keysOf), ...RUNTIME_KEYS])]
  .filter((key) => (namespaces as readonly string[]).includes(key.split('.')[0]))
  .sort();

describe('i18n keys', () => {
  test.each(keys)('%s has a text in both languages', (key) => {
    const dot = key.indexOf('.');
    for (const lang of ['en', 'fr']) {
      expect(dictionaries[lang][key.slice(0, dot)]?.[key.slice(dot + 1)], lang).toBeTypeOf(
        'string'
      );
    }
  });
});
