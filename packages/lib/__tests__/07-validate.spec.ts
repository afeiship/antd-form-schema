import { describe, expect, it } from 'vitest';
import { validateMeta } from '../src/validate';

describe('validateMeta', () => {
  it('reports non-array fields as error', () => {
    const issues = validateMeta({ fields: 'oops' } as any);
    expect(issues).toEqual([{ level: 'error', message: 'fields must be an array' }]);
  });

  it('reports missing and duplicate keys as errors with index', () => {
    const issues = validateMeta({ fields: [{ key: 'a' }, { widget: 'input' } as any, { key: 'a' }] });
    expect(issues.filter((i) => i.level === 'error')).toEqual([
      { level: 'error', message: 'field at index 1 is missing key', index: 1 },
      { level: 'error', message: 'duplicate key "a" at index 2', index: 2, field: 'a' },
    ]);
  });

  it('reports unregistered widget strings as errors, builtin and custom widgets pass', () => {
    expect(validateMeta({ fields: [{ key: 'a', widget: 'mystery' }] })).toEqual([
      { level: 'error', message: 'unregistered widget "mystery"', field: 'a' },
    ]);
    expect(validateMeta({ fields: [{ key: 'a', widget: 'select' }] })).toEqual([]);
    expect(
      validateMeta(
        { fields: [{ key: 'a', widget: 'custom' }] },
        { custom: { component: () => null } },
      ),
    ).toEqual([]);
  });

  it('accepts component widgets without registration', () => {
    const Widget = () => null;
    expect(validateMeta({ fields: [{ key: 'a', widget: Widget }] })).toEqual([]);
  });

  it('warns when condition.field does not exist, including nested paths', () => {
    const issues = validateMeta({
      fields: [
        { key: 'a', condition: { field: 'ghost', op: 'eq', value: 1 } },
        { key: 'b', condition: { and: [{ field: 'user.missing', op: 'empty' }] } },
        { key: 'c', condition: { field: '!!!missing.dot', op: 'empty' } },
      ],
    });
    expect(issues).toEqual([
      { level: 'warning', message: 'condition field "ghost" does not exist', field: 'ghost' },
      { level: 'warning', message: 'condition field "user.missing" does not exist', field: 'user.missing' },
      { level: 'warning', message: 'condition field "!!!missing.dot" does not exist', field: '!!!missing.dot' },
    ]);
  });

  it('accepts condition fields that resolve to existing keys', () => {
    expect(
      validateMeta({
        fields: [
          { key: 'user.name' },
          { key: '!!!a.b' },
          { key: 'x', condition: { field: 'user.name', op: 'eq', value: 'Ann' } },
          { key: 'y', condition: { field: '!!!a.b', op: 'empty' } },
        ],
      }),
    ).toEqual([]);
  });

  it('reports non-array options as error', () => {
    expect(validateMeta({ fields: [{ key: 'a', options: 'bad' as any }] })).toEqual([
      { level: 'error', message: 'options must be an array', field: 'a' },
    ]);
  });

  it('warns on invalid rules', () => {
    expect(validateMeta({ fields: [{ key: 'a', rules: 'bad' as any }] })).toEqual([
      { level: 'warning', message: 'rules must be an array of objects', field: 'a' },
    ]);
    expect(validateMeta({ fields: [{ key: 'a', rules: [null as any] }] })).toEqual([
      { level: 'warning', message: 'rules must be an array of objects', field: 'a' },
    ]);
  });

  it('returns no issues for valid meta', () => {
    expect(
      validateMeta({
        name: 'demo',
        disabled: true,
        initialValues: { a: 1 },
        fields: [
          { key: 'a', required: true, options: ['x', 'y'], rules: [{ required: true }] },
          { key: 'b', widget: 'select', condition: { field: 'a', op: 'eq', value: 'x' } },
        ],
      }),
    ).toEqual([]);
  });
});
