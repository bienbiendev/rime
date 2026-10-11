import { buildConfigMap } from '#lib/core/pipeline/config-map/index.js';
import { validateFields } from '#lib/core/pipeline/hooks/validate-fields.server.js';
import { text } from '#lib/fields/text/index.js';
import { describe, expect, test } from 'vitest';
import { uploadDocType } from './doc-type.js';
import { augmentUpload } from './module.js';

describe('augmentUpload', () => {
  const config = augmentUpload({
    slug: 'medias',
    fields: [],
    upload: { imageSizes: [{ name: 'large-square', width: 800 }] }
  } as any);

  test('size names are camelCased once, the thumbnail first', () => {
    expect(config.upload!.imageSizes!.map((size) => size.name)).toEqual([
      'thumbnail',
      'largeSquare'
    ]);
    const field = config.fields.find((field: any) => field.name === 'largeSquare') as any;
    expect(field?.get.hidden).toBe(true);
  });

  test('the generated type names the sizes as the columns do', () => {
    expect(uploadDocType(config).members).toEqual([
      'sizes:{thumbnail: string, largeSquare: string}'
    ]);
  });

  test('`upload: true` gets the thumbnail only, and is titled by its file name', () => {
    const files = augmentUpload({ slug: 'files', fields: [], upload: true } as any);
    expect(files.upload!.imageSizes!.map((size) => size.name)).toEqual(['thumbnail']);
    expect(files._titleFallback).toBe('filename');
  });

  test('an authored thumbnail is kept once', () => {
    const files = augmentUpload({
      slug: 'files',
      fields: [],
      upload: { imageSizes: [{ name: 'thumbnail', width: 120 }] }
    } as any);
    expect(files.upload!.imageSizes).toEqual([{ name: 'thumbnail', width: 120 }]);
  });

  test('`accept` checks the mime type', () => {
    const files = augmentUpload({
      slug: 'files',
      fields: [],
      upload: { accept: ['image/png'] }
    } as any);
    const mimeType = files.fields.find((field: any) => field.name === 'mimeType') as any;
    expect(mimeType.use.validate('image/png', {} as never)).toBe(true);
    expect(mimeType.use.validate('text/html', {} as never)).not.toBe(true);
  });
});

describe('the stored file names', () => {
  const config = augmentUpload({ slug: 'medias', fields: [text('alt')], upload: {} } as any);

  /** `data` through a staff request's field checks, as `operation`. */
  const written = async (operation: 'create' | 'update', data: Record<string, unknown>) => {
    const event = {
      url: new URL('http://localhost/api/medias'),
      locals: {
        user: { id: 'u1', isStaff: true, roles: ['admin'] },
        rime: { config: { isCollection: () => true } }
      }
    };
    const result = await validateFields({
      data,
      config,
      event,
      operation,
      context: {
        params: {},
        originalDoc: operation === 'update' ? { id: 'd1' } : undefined,
        configMap: buildConfigMap(data, config.fields)
      }
    } as any);
    return result.data;
  };

  test.each(['create', 'update'] as const)('%s: a request cannot write them', async (operation) => {
    const data = { alt: 'x', filename: '../../.env', thumbnail: '../../src/hooks.server.ts' };
    expect(await written(operation, data)).toEqual({ alt: 'x' });
  });
});
