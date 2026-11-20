import { describe, expect, it } from 'vitest';
import { normalizeMeta } from '../src/core/normalize';
import { normalizeOptions, resolveName, toNamePath } from '../src/core/utils';

describe('normalize', () => {
  it('splits dotted key into NamePath', () => {
    expect(resolveName({ key: 'user.name' })).toEqual(['user', 'name']);
  });

  it('keeps !!!-prefixed key literal', () => {
    expect(resolveName({ key: '!!!a.b' })).toEqual(['a.b']);
    expect(toNamePath('!!!a.b')).toEqual(['a.b']);
  });

  it('prefers explicit name over key', () => {
    expect(resolveName({ key: 'a.b', name: ['x', 'y'] })).toEqual(['x', 'y']);
  });

  it('normalizes three option shapes', () => {
    expect(normalizeOptions(['Apple'])).toEqual([{ value: 'Apple', label: 'Apple' }]);
    expect(normalizeOptions([['apple', '苹果']])).toEqual([{ value: 'apple', label: '苹果' }]);
    const obj = { value: 'a', label: 'A', disabled: true, key: 'k' };
    expect(normalizeOptions([obj])).toEqual([obj]);
    expect(normalizeOptions()).toEqual([]);
  });

  it('converts required to rule', () => {
    expect(normalizeMeta({ fields: [{ key: 'x', required: true }] }).fields[0].rules).toEqual([
      { required: true },
    ]);
  });

  it('keeps explicit rules and appends required', () => {
    const rules = [{ pattern: /^a/, message: 'must start with a' }];
    const result = normalizeMeta({ fields: [{ key: 'x', required: true, rules }] });
    expect(result.fields[0].rules).toEqual([{ required: true }, ...rules]);
  });

  it('defaults widget to input and disabled from form level', () => {
    const result = normalizeMeta({
      disabled: true,
      fields: [{ key: 'a' }, { key: 'b', disabled: false }],
    });
    expect(result.fields[0].widget).toBe('input');
    expect(result.fields[0].disabled).toBe(true);
    expect(result.fields[1].disabled).toBe(false);
  });

  it('defaults options to empty array', () => {
    expect(normalizeMeta({ fields: [{ key: 'x' }] }).fields[0].options).toEqual([]);
  });

  it('does not mutate input meta', () => {
    const meta = { fields: [{ key: 'x', required: true, options: ['a'] }] };
    const snapshot = JSON.parse(JSON.stringify(meta));
    normalizeMeta(meta);
    expect(meta).toEqual(snapshot);
  });
});
