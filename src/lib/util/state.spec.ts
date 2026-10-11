import { expect, test } from 'vitest';
import { snapshot } from './state.js';

test('a value that holds itself gives a copy that holds itself', () => {
  const value: any = { list: [1] };
  value.self = value;
  const copy = snapshot(value);
  expect(copy).not.toBe(value);
  expect(copy.self).toBe(copy);
  expect(copy.list).toEqual([1]);
  expect(copy.list).not.toBe(value.list);
});

test('a class instance is kept as it is', () => {
  class Point {
    constructor(public x: number) {}
    get double() {
      return this.x * 2;
    }
  }
  const point = new Point(2);
  expect(snapshot({ point }).point).toBe(point);
});
