import { describe, it, expect, vi } from 'vitest';
import { mapWithConcurrency } from '../../src/shared/concurrency.js';

describe('mapWithConcurrency', () => {
  it('returns empty array for empty input', async () => {
    const results = await mapWithConcurrency([], 4, vi.fn());
    expect(results).toEqual([]);
  });

  it('with concurrency=1 behaves like sequential', async () => {
    const order: number[] = [];
    const items = [1, 2, 3, 4, 5];

    const results = await mapWithConcurrency(items, 1, async (item) => {
      order.push(item);
      return item * 2;
    });

    expect(order).toEqual([1, 2, 3, 4, 5]);
    expect(
      results.map((r) => (r as PromiseFulfilledResult<number>).value)
    ).toEqual([2, 4, 6, 8, 10]);
  });

  it('returns results in input order regardless of completion order', async () => {
    const items = [100, 50, 200, 10];

    const results = await mapWithConcurrency(items, 4, async (ms) => {
      await new Promise((r) => setTimeout(r, ms));
      return ms;
    });

    const values = results.map(
      (r) => (r as PromiseFulfilledResult<number>).value
    );
    expect(values).toEqual([100, 50, 200, 10]);
  });

  it('one task failure does not cancel others', async () => {
    const items = [1, 2, 3, 4];
    const completed: number[] = [];

    const results = await mapWithConcurrency(items, 2, async (item) => {
      if (item === 2) throw new Error('boom');
      completed.push(item);
      return item;
    });

    expect(completed).toHaveLength(3);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    expect(results[2].status).toBe('fulfilled');
    expect(results[3].status).toBe('fulfilled');
  });

  it('limits concurrency to specified number', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);

    await mapWithConcurrency(items, 3, async (item) => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 10));
      concurrent--;
      return item;
    });

    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });

  it('handles concurrency > items.length', async () => {
    const items = [1, 2];
    const results = await mapWithConcurrency(
      items,
      10,
      async (item) => item * 3
    );

    const values = results.map(
      (r) => (r as PromiseFulfilledResult<number>).value
    );
    expect(values).toEqual([3, 6]);
  });
});
