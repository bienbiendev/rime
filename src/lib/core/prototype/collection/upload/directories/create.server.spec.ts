import { describe, expect, test, vi } from 'vitest';
import { createDirectory } from './create.server.js';

/** A folders collection whose create does `create`, and whose read finds `stored`. */
const folders = (create: () => Promise<unknown>, stored: unknown = undefined) => ({
  create: vi.fn(create),
  findById: vi.fn(async () => {
    if (!stored) throw new Error('not_found');
    return stored;
  })
});

describe('createDirectory', () => {
  test('creates the folder, and reads nothing back', async () => {
    const directories = folders(async () => ({ id: 'root' }));
    await createDirectory(directories as any, { id: 'root' });
    expect(directories.create).toHaveBeenCalledWith({ data: { id: 'root' } });
    expect(directories.findById).not.toHaveBeenCalled();
  });

  test('a create that loses the race to another request is no error', async () => {
    const duplicate = async () => {
      throw new Error('duplicate id');
    };
    const directories = folders(duplicate, { id: 'root' });
    await expect(createDirectory(directories as any, { id: 'root' })).resolves.toBeUndefined();
  });

  test('a create that fails while the folder is still missing throws its error', async () => {
    const refused = async () => {
      throw new Error('database is locked');
    };
    const directories = folders(refused);
    await expect(createDirectory(directories as any, { id: 'root' })).rejects.toThrow(
      'database is locked'
    );
  });
});
