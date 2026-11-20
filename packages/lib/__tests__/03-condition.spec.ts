import { describe, expect, it, vi } from 'vitest';
import { collectWatchPaths, evaluateCondition, getConditionPaths } from '../src/core/condition';
import type { Condition } from '../src/core/types';

const ctx = (values: Record<string, any>, form: any = {}) => ({ form, values });

const evalField = (condition: Condition, values: Record<string, any>) =>
  evaluateCondition(condition, ctx(values));

describe('evaluateCondition: comparison operators', () => {
  it('eq / ne use strict equality', () => {
    expect(evalField({ field: 'a', op: 'eq', value: 1 }, { a: 1 })).toBe(true);
    expect(evalField({ field: 'a', op: 'eq', value: '1' }, { a: 1 })).toBe(false);
    expect(evalField({ field: 'a', op: 'ne', value: 1 }, { a: 1 })).toBe(false);
    expect(evalField({ field: 'a', op: 'ne', value: 2 }, { a: 1 })).toBe(true);
  });

  it('gt / gte compare numerically', () => {
    expect(evalField({ field: 'a', op: 'gt', value: 2 }, { a: '10' })).toBe(true);
    expect(evalField({ field: 'a', op: 'gte', value: 10 }, { a: '10' })).toBe(true);
    expect(evalField({ field: 'a', op: 'gt', value: 20 }, { a: '10' })).toBe(false);
  });

  it('lt / lte compare numerically', () => {
    expect(evalField({ field: 'a', op: 'lt', value: 20 }, { a: '10' })).toBe(true);
    expect(evalField({ field: 'a', op: 'lte', value: 10 }, { a: '10' })).toBe(true);
    expect(evalField({ field: 'a', op: 'lt', value: 5 }, { a: '10' })).toBe(false);
  });

  it('gt..lte fall back to string comparison for non-numeric values', () => {
    expect(evalField({ field: 'a', op: 'gt', value: 'abc' }, { a: 'abd' })).toBe(true);
    expect(evalField({ field: 'a', op: 'lt', value: 'abd' }, { a: 'abc' })).toBe(true);
    expect(evalField({ field: 'a', op: 'gte', value: 'abc' }, { a: 'abc' })).toBe(true);
  });

  it('in / nin check value membership in the candidate array', () => {
    expect(evalField({ field: 'a', op: 'in', value: ['x', 'y'] }, { a: 'y' })).toBe(true);
    expect(evalField({ field: 'a', op: 'in', value: ['x', 'y'] }, { a: 'z' })).toBe(false);
    expect(evalField({ field: 'a', op: 'nin', value: ['x', 'y'] }, { a: 'z' })).toBe(true);
  });

  it('includes checks an array field contains the operand', () => {
    expect(evalField({ field: 'tags', op: 'includes', value: 'b' }, { tags: ['a', 'b'] })).toBe(true);
    expect(evalField({ field: 'tags', op: 'includes', value: 'c' }, { tags: ['a', 'b'] })).toBe(false);
  });

  it('empty is true for null/undefined/empty string/empty array/empty object only', () => {
    for (const value of [null, undefined, '', [], {}]) {
      expect(evalField({ field: 'a', op: 'empty' }, { a: value })).toBe(true);
    }
    expect(evalField({ field: 'a', op: 'empty' }, { a: 0 })).toBe(false);
    expect(evalField({ field: 'a', op: 'empty' }, { a: false })).toBe(false);
  });

  it('notEmpty negates empty', () => {
    expect(evalField({ field: 'a', op: 'notEmpty' }, { a: 'x' })).toBe(true);
    expect(evalField({ field: 'a', op: 'notEmpty' }, { a: [] })).toBe(false);
  });

  it('resolves nested and !!!-literal field paths', () => {
    expect(evalField({ field: 'user.name', op: 'eq', value: 'Ann' }, { user: { name: 'Ann' } })).toBe(true);
    expect(evalField({ field: '!!!a.b', op: 'eq', value: 1 }, { 'a.b': 1 })).toBe(true);
  });
});

describe('evaluateCondition: logic', () => {
  it('and / or / not recurse', () => {
    expect(
      evalField(
        { and: [{ field: 'a', op: 'eq', value: 1 }, { field: 'b', op: 'eq', value: 2 }] },
        { a: 1, b: 2 },
      ),
    ).toBe(true);
    expect(
      evalField(
        { and: [{ field: 'a', op: 'eq', value: 1 }, { field: 'b', op: 'eq', value: 3 }] },
        { a: 1, b: 2 },
      ),
    ).toBe(false);
    expect(
      evalField(
        { or: [{ field: 'a', op: 'eq', value: 9 }, { field: 'b', op: 'eq', value: 2 }] },
        { a: 1, b: 2 },
      ),
    ).toBe(true);
    expect(evalField({ not: { field: 'a', op: 'eq', value: 2 } }, { a: 1 })).toBe(true);
  });
});

describe('condition paths & function conditions', () => {
  it('getConditionPaths normalizes fields recursively', () => {
    expect(
      getConditionPaths({
        or: [{ field: 'user.name', op: 'eq', value: 'a' }, { field: '!!!a.b', op: 'empty' }],
      }),
    ).toEqual([
      ['user', 'name'],
      ['a.b'],
    ]);
  });

  it('collectWatchPaths collects and dedupes fields, honoring !!! literals', () => {
    const paths = collectWatchPaths([
      { key: 'x', condition: { field: 'a', op: 'eq', value: 1 } },
      { key: 'y', condition: { and: [{ field: 'a', op: 'eq', value: 1 }, { field: '!!!b.c', op: 'empty' }] } },
      { key: 'z', condition: ({ values }) => values.flag === true, watch: ['flag', 'flag'] },
    ]);
    expect(paths).toEqual([['a'], ['b.c'], 'flag']);
  });

  it('passes form and values to function conditions', () => {
    const form = { getFieldsValue: () => ({ role: 'admin' }) } as any;
    const fn = vi.fn(({ form: f, values }) => f.getFieldsValue().role === 'admin' && values.role === 'admin');
    expect(evaluateCondition(fn, ctx({ role: 'admin' }, form))).toBe(true);
    expect(fn).toHaveBeenCalledWith({ form, values: { role: 'admin' } });
  });

  it('derives values from form.getFieldsValue(true) when values are absent', () => {
    const form = { getFieldsValue: vi.fn(() => ({ role: 'admin' })) } as any;
    expect(evaluateCondition(({ values }) => values.role === 'admin', { form } as any)).toBe(true);
    expect(form.getFieldsValue).toHaveBeenCalledWith(true);
  });

  it('collectWatchPaths returns [] for fields without conditions', () => {
    expect(collectWatchPaths([{ key: 'a' }, { key: 'b' }])).toEqual([]);
  });
});
