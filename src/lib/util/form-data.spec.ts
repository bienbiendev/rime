import { describe, expect, it } from 'vitest';
import { readFormData, writeFormData } from './form-data.js';

describe('writeFormData / readFormData', () => {
  it('keeps every value with its type and its nesting, files included', () => {
    const file = new File(['x'], 'photo.jpg');
    const values = {
      title: '2024',
      code: '007',
      meta: { priority: 4, done: true },
      tags: [],
      cleared: null,
      file
    };
    const read = readFormData(writeFormData(values));
    expect(read).toEqual({ ...values, file: expect.any(File) });
    expect((read?.file as File).name).toBe('photo.jpg');
  });

  it('a string entry beside _data replaces the JSON value of the same key', () => {
    const formData = writeFormData({ title: 'a' });
    formData.set('title', 'b');
    expect(readFormData(formData)).toEqual({ title: 'b' });
  });

  it('reads nothing from a form it did not write', () => {
    const handWritten = new FormData();
    handWritten.set('title', '2024');
    expect(readFormData(handWritten)).toBeNull();
  });
});
