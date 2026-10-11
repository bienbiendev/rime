import { RimeError } from '#lib/core/errors/index.js';
import { describe, expect, test } from 'vitest';
import { castBase64ToFile } from './convert-base64.server.js';

const upload = (file: unknown) =>
  ({
    data: { file },
    event: { locals: { rime: { logger: { error: () => {} } } } }
  }) as any;

const refusal = (file: unknown) =>
  castBase64ToFile(upload(file)).then(
    () => null,
    (error: RimeError) => ({ status: error.status, message: error.message })
  );

describe('castBase64ToFile', () => {
  test('a file that is not a data URL answers 400', async () => {
    expect(await refusal({ base64: 'not-a-data-url' })).toEqual({
      status: 400,
      message: expect.stringContaining('Invalid base64 data format')
    });
  });

  test('a file type rime does not know answers 400, with its reason', async () => {
    expect(await refusal({ base64: 'data:application/x-foo;base64,AAAA' })).toEqual({
      status: 400,
      message: expect.stringContaining('File type not supported')
    });
  });
});
