import { describe, expect, it } from 'vitest';
import { listColumns } from './columns.js';

describe('listColumns', () => {
  it('lays out every part', () => {
    expect(listColumns({ columns: 2, status: true, author: true })).toBe(
      'var(--rz-size-4) minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) var(--rz-size-28) var(--rz-size-32) var(--rz-size-24)'
    );
  });

  it('leaves out the parts not asked for', () => {
    expect(listColumns({})).toBe('var(--rz-size-4) minmax(0, 2fr) var(--rz-size-24)');
    expect(listColumns({ author: true })).toBe(
      'var(--rz-size-4) minmax(0, 2fr) var(--rz-size-32) var(--rz-size-24)'
    );
  });
});
