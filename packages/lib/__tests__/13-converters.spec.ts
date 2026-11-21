import { describe, expect, it, vi } from 'vitest';
import { getItemProps } from '../src/core/bind';
import {
  applyFieldConverter,
  readConvertedValue,
  resolveConverter,
} from '../src/core/converters';
import { normalizeMeta } from '../src/core/normalize';
import type { FieldConverter, FormSchema } from '../src/core/types';

const money: FieldConverter = {
  read: (value) => (value == null ? value : Number(value) / 100),
  write: (value) => (value == null ? value : Math.round(Number(value) * 100)),
};

function prepare(overrides: Partial<FormSchema['fields'][number]> = {}) {
  const meta: FormSchema = { fields: [{ key: 'amount', converter: 'money', ...overrides }] };
  const field = normalizeMeta(meta).fields[0];
  const itemProps = getItemProps(field);
  return { field, itemProps, meta };
}

describe('resolveConverter', () => {
  it('returns the registered converter by id', () => {
    expect(resolveConverter('money', { money })).toBe(money);
  });

  it('returns undefined for missing ids and missing registry', () => {
    expect(resolveConverter('nope', { money })).toBeUndefined();
    expect(resolveConverter('money', undefined)).toBeUndefined();
    expect(resolveConverter(undefined, { money })).toBeUndefined();
  });
});

describe('applyFieldConverter', () => {
  it('reads stored cents as yuan', () => {
    const { field, itemProps, meta } = prepare();
    const result = applyFieldConverter(itemProps, money, { field, values: {}, meta });
    expect(result.getValueProps!(1999)).toEqual({ value: 19.99 });
    expect(result.getValueProps!(null)).toEqual({ value: null });
  });

  it('writes control value back as cents', () => {
    const { field, itemProps, meta } = prepare();
    const result = applyFieldConverter(itemProps, money, { field, values: {}, meta });
    expect(result.getValueFromEvent!({ target: { value: '20.5' } } as any)).toBe(2050);
  });

  it('extracts checked from checkbox events', () => {
    const { field, itemProps, meta } = prepare({ valuePropName: 'checked' });
    const converter: FieldConverter = { write: (value) => value === true };
    const result = applyFieldConverter(itemProps, converter, { field, values: {}, meta });
    expect(
      result.getValueFromEvent!({ target: { type: 'checkbox', checked: true } } as any),
    ).toBe(true);
  });

  it('passes a plain first argument through to write', () => {
    const { field, itemProps, meta } = prepare();
    const result = applyFieldConverter(itemProps, money, { field, values: {}, meta });
    expect(result.getValueFromEvent!('20.5')).toBe(2050);
  });

  it('lets field.itemProps override converter hooks', () => {
    const { field, itemProps, meta } = prepare();
    const result = applyFieldConverter(itemProps, money, { field, values: {}, meta });
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
    const result = applyFieldConverter(itemProps, money, { field, values: {}, meta }, true);
    expect(result.getValueFromEvent).toBeUndefined();
  });

  it('returns the original itemProps when converter is missing', () => {
    const { itemProps } = prepare();
    expect(applyFieldConverter(itemProps, undefined as any, undefined as any)).toBe(itemProps);
  });

  it('falls back to the original value and warns when read throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { field, itemProps, meta } = prepare();
    const bad: FieldConverter = {
      read: () => {
        throw new Error('boom');
      },
    };
    const result = applyFieldConverter(itemProps, bad, { field, values: {}, meta });
    expect(result.getValueProps?.(1999)).toEqual({ value: 1999 });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('reads values for view mode without touching itemProps', () => {
    const { field, meta } = prepare();
    expect(readConvertedValue(1999, money, field, {}, meta)).toBe(19.99);
    expect(readConvertedValue(1999, undefined, field, {}, meta)).toBe(1999);
  });
});
