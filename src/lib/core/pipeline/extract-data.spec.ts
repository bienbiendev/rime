import { RimeFormError } from '#lib/core/errors/index.js';
import { writeFormData } from '#lib/util/form-data.js';
import { describe, expect, it } from 'vitest';
import { extractData } from './extract-data.server.js';

const post = (body: BodyInit, headers: HeadersInit = {}) =>
  new Request('http://localhost/api/pages', { method: 'POST', headers, body });

describe('extractData', () => {
  it('takes a JSON body as it is: types, nesting and keys', async () => {
    const body = { title: '2024', meta: { priority: 4 }, done: 'true', 'a.b': 1 };
    const request = post(JSON.stringify(body), { 'content-type': 'application/json' });
    expect(await extractData(request)).toEqual(body);
  });

  it("reads the panel's form with its types and its nesting", async () => {
    const values = { title: '007', meta: { featured: false }, tags: [] };
    expect(await extractData(post(writeFormData(values)))).toEqual(values);
  });

  it('keeps a hand-written form as strings, a repeated key as a list', async () => {
    const form = new FormData();
    form.set('zip', '01234');
    form.set('ref', '12345678901234567890');
    form.set('meta.count', '12');
    form.append('tags', 'a');
    form.append('tags', 'b');
    form.set('cleared', 'null');
    expect(await extractData(post(form))).toEqual({
      zip: '01234',
      ref: '12345678901234567890',
      meta: { count: '12' },
      tags: ['a', 'b'],
      cleared: null
    });
  });

  it('refuses a JSON body that is not an object', async () => {
    for (const body of ['null', '[]', '"title"', '4']) {
      const request = post(body, { 'content-type': 'application/json' });
      await expect(extractData(request)).rejects.toBeInstanceOf(RimeFormError);
    }
  });
});
