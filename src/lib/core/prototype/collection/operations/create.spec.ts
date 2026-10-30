import { text } from '#lib/fields/text/index.js';
import { describe, expect, it } from 'vitest';
import { withoutUndeclaredId } from './create.js';

describe('withoutUndeclaredId', () => {
  it('drops the id a caller sends to a config with no id field', () => {
    expect(withoutUndeclaredId({ id: 'count', title: 'x' }, [text('title')])).toEqual({
      title: 'x'
    });
  });

  it('keeps the id of a config that declares one, as upload directories do', () => {
    expect(withoutUndeclaredId({ id: 'root:press' }, [text('id')])).toEqual({ id: 'root:press' });
  });
});
