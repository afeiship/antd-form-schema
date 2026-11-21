import { describe, expect, it, vi } from 'vitest';
import { getItemProps } from '../src/core/bind';
import {
  applyFieldConverter,
  normalizeConverterIds,
  readConvertedValue,
  resolveConverter,
  resolveConverterChain,
} from '../src/core/converters';
import { normalizeMeta } from '../src/core/normalize';
import type { FieldConverter, FormSchema } from '../src/core/types';

const money: FieldConverter = {
  read: (value) => (value == null ? value : Number(value) / 100),
  write: (value) => (value == null ? value : Math.round(Number(value) * 100)),
};

const fixed2: FieldConverter = {
  read: (value) => (value == null ? value : Number(value).toFixed(2)),
  write: (value) => (value == null || value === '' ? value : Number(value)),
};

const registry = { money, fixed2 };

function chainOf(...ids: string[]) {
  return resolveConverterChain(ids, registry);
}

function prepare(overrides: Partial<FormSchema['fields'][number]> = {}) {
  const meta: FormSchema = { fields: [{ key: 'amount', converter: 'money', ...overrides }] };
  const field = normalizeMeta(meta).fields[0];
  const itemProps = getItemProps(field);
  return { field, itemProps, meta };
}

describe('converter refs', () => {
  it('normalizes strings, arrays, empty arrays and undefined', () => {
    expect(normalizeConverterIds('money')).toEqual(['money']);
    expect(normalizeConverterIds(['money', 'fixed2'])).toEqual(['money', 'fixed2']);
    expect(normalizeConverterIds(['money', ''] as any)).toEqual(['money']);
    expect(normalizeConverterIds([])).toEqual([]);
    expect(normalizeConverterIds(undefined)).toEqual([]);
  });

  it('resolves a chain in order and skips unknown ids', () => {
    expect(resolveConverterChain('money', registry).map((step) => step.id)).toEqual(['money']);
    expect(resolveConverterChain(['money', 'nope', 'fixed2'], registry).map((step) => step.id)).toEqual([
      'money',
      'fixed2',
    ]);
    expect(resolveConverterChain(undefined, registry)).toEqual([]);
  });

  it('returns a single converter by id', () => {
    expect(resolveConverter('money', registry)).toBe(money);
    expect(resolveConverter('nope', registry)).toBeUndefined();
    expect(resolveConverter('money', undefined)).toBeUndefined();
    expect(resolveConverter(undefined, registry)).toBeUndefined();
  });
});

describe('applyFieldConverter chain', () => {
  it('reads stored cents as yuan through a single converter', () => {
    const { field, itemProps, meta } = prepare();
    const result = applyFieldConverter(itemProps, chainOf('money'), { field, values: {}, meta });
    expect(result.getValueProps!(1999)).toEqual({ value: 19.99 });
    expect(result.getValueProps!(null)).toEqual({ value: null });
  });

  it('runs read forward', () => {
    const calls: string[] = [];
    const a: FieldConverter = { read: (value) => (calls.push('a'), value + 1) };
    const b: FieldConverter = { read: (value) => (calls.push('b'), value * 2) };
    const { field, itemProps, meta } = prepare();
    const result = applyFieldConverter(itemProps, resolveConverterChain(['a', 'b'], { a, b }), {
      field,
      values: {},
      meta,
    });
    result.getValueProps!(3);
    expect(calls).toEqual(['a', 'b']);
  });

  it('runs write backward', () => {
    const calls: string[] = [];
    const a: FieldConverter = { write: (value) => (calls.push('a'), value - 1) };
    const b: FieldConverter = { write: (value) => (calls.push('b'), value / 2) };
    const { field, itemProps, meta } = prepare();
    const result = applyFieldConverter(itemProps, resolveConverterChain(['a', 'b'], { a, b }), {
      field,
      values: {},
      meta,
    });
    const written = result.getValueFromEvent!({ target: { value: 10 } } as any);
    expect(calls).toEqual(['b', 'a']);
    expect(written).toBe(4);
  });

  it('composes money then fixed2 in both directions', () => {
    const { field, itemProps, meta } = prepare({ converter: ['money', 'fixed2'] });
    const result = applyFieldConverter(itemProps, chainOf('money', 'fixed2'), {
      field,
      values: {},
      meta,
    });
    expect(result.getValueProps!(1999)).toEqual({ value: '19.99' });
    expect(result.getValueFromEvent!({ target: { value: '20.50' } } as any)).toBe(2050);
  });

  it('writes control value back as cents with a single converter', () => {
    const { field, itemProps, meta } = prepare();
    const result = applyFieldConverter(itemProps, chainOf('money'), { field, values: {}, meta });
    expect(result.getValueFromEvent!({ target: { value: '20.5' } } as any)).toBe(2050);
    expect(result.getValueFromEvent!('20.5')).toBe(2050);
  });

  it('extracts checked from checkbox events', () => {
    const { field, itemProps, meta } = prepare({ valuePropName: 'checked' });
    const converter: FieldConverter = { write: (value) => value === true };
    const result = applyFieldConverter(itemProps, resolveConverterChain('checkbox', { checkbox: converter }), {
      field,
      values: {},
      meta,
    });
    expect(
      result.getValueFromEvent!({ target: { type: 'checkbox', checked: true } } as any),
    ).toBe(true);
  });

  it('lets field.itemProps override converter hooks', () => {
    const { field, itemProps, meta } = prepare();
    const result = applyFieldConverter(itemProps, chainOf('money'), { field, values: {}, meta });
    const overridden = {
      ...result,
      getValueProps: () => ({ value: 'mine' }),
      getValueFromEvent: () => 'mine',
    };
    expect(overridden.getValueProps!('anything')).toEqual({ value: 'mine' });
    expect(overridden.getValueFromEvent!('anything')).toBe('mine');
  });

  it('skips write in view mode', () => {
    const { field, itemProps, meta } = prepare();
    const result = applyFieldConverter(itemProps, chainOf('money'), { field, values: {}, meta }, true);
    expect(result.getValueFromEvent).toBeUndefined();
  });

  it('returns the original itemProps when the chain is empty', () => {
    const { itemProps } = prepare();
    expect(applyFieldConverter(itemProps, [], undefined as any)).toBe(itemProps);
  });

  it('falls back to the original value and warns once when a step throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { field, itemProps, meta } = prepare();
    const a: FieldConverter = { read: (value) => value + 1 };
    const b: FieldConverter = {
      read: () => {
        throw new Error('boom');
      },
    };
    const result = applyFieldConverter(itemProps, resolveConverterChain(['a', 'b'], { a, b }), {
      field,
      values: {},
      meta,
    });
    expect(result.getValueProps!(1999)).toEqual({ value: 1999 });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('reads values for view mode through the chain', () => {
    const { field, meta } = prepare();
    expect(readConvertedValue(1999, chainOf('money'), field, {}, meta)).toBe(19.99);
    expect(readConvertedValue(1999, chainOf('money', 'fixed2'), field, {}, meta)).toBe('19.99');
    expect(readConvertedValue(1999, [], field, {}, meta)).toBe(1999);
  });
});
