import { RimeError } from '#lib/core/errors/index.js';
import { describe, expect, it, vi } from 'vitest';
import { runBeforeOperation, runDataHooks, runDocHooks, undoOnError } from './run.server.js';

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

describe('undoOnError', () => {
  it('runs the undo steps, newest first, then throws the same error', async () => {
    const ran: string[] = [];
    const undo = [async () => void ran.push('user'), async () => void ran.push('key')];
    const failure = new Error('insert failed');

    await expect(undoOnError(undo, () => Promise.reject(failure))).rejects.toBe(failure);
    expect(ran).toEqual(['key', 'user']);
  });

  it('runs no step when the write succeeds', async () => {
    const step = vi.fn(async () => {});
    await expect(undoOnError([step], async () => 'row')).resolves.toBe('row');
    expect(step).not.toHaveBeenCalled();
  });

  it('runs the steps after one that fails', async () => {
    const last = vi.fn(async () => {});
    const undo = [last, () => Promise.reject(new Error('undo failed'))];

    await expect(undoOnError(undo, () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    expect(last).toHaveBeenCalled();
  });
});
