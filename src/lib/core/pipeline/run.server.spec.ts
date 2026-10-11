import { RimeError } from '#lib/core/errors/index.js';
import { describe, expect, it } from 'vitest';
import { runBeforeOperation, runDataHooks, runDocHooks } from './run.server.js';

const base = { config: {} as any, event: {} as any, context: { params: {} } };

/** A hook that forgets `return args`. */
async function forgetsToReturn() {}

const refusal = (missing: string) =>
  expect.objectContaining({
    code: RimeError.OPERATION_ERROR,
    message: expect.stringContaining(`hook forgetsToReturn answered without ${missing}`)
  });

describe('a hook that answers without its arguments', () => {
  it('is named in the error of a beforeOperation chain', async () => {
    const run = runBeforeOperation({
      ...base,
      config: { $hooks: { beforeOperation: [forgetsToReturn] } } as any,
      operation: 'read'
    });
    await expect(run).rejects.toEqual(refusal('context'));
  });

  it('is named in the error of a data chain', async () => {
    const run = runDataHooks({ ...base, hooks: [forgetsToReturn], data: {}, operation: 'create' });
    await expect(run).rejects.toEqual(refusal('data, config, context'));
  });

  it('is named in the error of a document chain', async () => {
    const run = runDocHooks({ ...base, hooks: [forgetsToReturn], doc: {}, operation: 'read' });
    await expect(run).rejects.toEqual(refusal('doc, context'));
  });

  it('passes when the hook hands its arguments back', async () => {
    const run = runDocHooks({
      ...base,
      hooks: [async (args: any) => args],
      doc: { id: 'd' },
      operation: 'read'
    });
    expect((await run).doc).toEqual({ id: 'd' });
  });
});
