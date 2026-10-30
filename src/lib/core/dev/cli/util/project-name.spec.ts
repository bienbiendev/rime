import { describe, expect, it, vi } from 'vitest';
import { projectName } from './project-name.js';

describe('projectName', () => {
  const ask = vi.fn(async (_question: string, defaultName: string) => defaultName);

  it('makes a slug of a scoped package name without asking, with --force', async () => {
    const asking = vi.fn(async (_question: string, defaultName: string) => defaultName);
    expect(await projectName({ packageName: '@acme/site', force: true, ask: asking })).toBe(
      'acmesite'
    );
    expect(asking).not.toHaveBeenCalled();
  });

  it('falls back to app when the slug of the package name is not a valid name', async () => {
    expect(await projectName({ packageName: '1password-clone', force: true, ask })).toBe('app');
    // Enter answers the default; a second question gets `other`
    const asking = vi
      .fn<(question: string, defaultName: string) => Promise<string>>(async () => 'other')
      .mockImplementationOnce(async (_question, defaultName) => defaultName);
    expect(await projectName({ packageName: '1password-clone', force: false, ask: asking })).toBe(
      'app'
    );
    expect(asking).toHaveBeenCalledTimes(1);
  });

  it('refuses a --name that is not a slug', async () => {
    expect(
      await projectName({ incomingName: '@acme/site', packageName: 'x', force: true, ask })
    ).toBe(null);
    expect(
      await projectName({ incomingName: 'my-site', packageName: 'x', force: false, ask })
    ).toBe('my-site');
  });

  it('asks, offering the slug of the package name, until the answer is a slug', async () => {
    const answers = ['not a slug', 'site'];
    const asking = vi.fn<(question: string, defaultName: string) => Promise<string>>(async () =>
      answers.shift()!
    );
    expect(await projectName({ packageName: '@acme/site', force: false, ask: asking })).toBe(
      'site'
    );
    expect(asking).toHaveBeenCalledTimes(2);
    expect(asking.mock.calls[0][1]).toBe('acmesite');
  });
});
