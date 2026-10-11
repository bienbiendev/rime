import { isStaff } from '#lib/core/auth/access.js';
import { describe, expect, it } from 'vitest';
import { definePrototype } from './define.js';

describe('definePrototype', () => {
  it('keeps the staff default for a rule written as undefined', () => {
    const anyone = () => true;
    const { create } = definePrototype({ name: 'collection' }) as any;
    const config = create('pages', { access: { read: undefined, update: anyone } });

    expect(config.access.read).toBe(isStaff);
    expect(config.access.update).toBe(anyone);
  });
});
