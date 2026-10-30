import { afterEach, describe, expect, it, vi } from 'vitest';
import { readStored, writeStored } from './storage.js';

/** A localStorage held in a Map. */
const memoryStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key)
  };
};

/** A localStorage whose every call throws, as where the browser blocks site data. */
const blockedStorage = () => {
  const blocked = () => {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  };
  return { getItem: blocked, setItem: blocked, removeItem: blocked };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readStored and writeStored', () => {
  it('read back what they keep, and remove a key for null', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', memoryStorage());

    writeStored('rz-open:abc', '1');
    expect(readStored('rz-open:abc')).toBe('1');
    writeStored('rz-open:abc', null);
    expect(readStored('rz-open:abc')).toBeNull();
  });

  it('read nothing and throw nothing where storage is blocked', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', blockedStorage());

    expect(() => writeStored('rz-open:abc', '1')).not.toThrow();
    expect(() => writeStored('rz-open:abc', null)).not.toThrow();
    expect(readStored('rz-open:abc')).toBeNull();
  });

  it('read nothing and leave storage alone with no window', () => {
    const storage = memoryStorage();
    storage.setItem('rz-open:abc', '1');
    vi.stubGlobal('localStorage', storage);

    expect(readStored('rz-open:abc')).toBeNull();
    writeStored('rz-open:abc', null);
    expect(storage.getItem('rz-open:abc')).toBe('1');
  });
});
