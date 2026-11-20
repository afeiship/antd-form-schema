import { normalizeOptions, resolveName } from '../core/utils';
import type { FormSchema, NormalizedField, NormalizedMeta } from './types';

/** Normalize a form schema without mutating the input. */
export function normalizeMeta(meta: FormSchema): NormalizedMeta {
  const fields: NormalizedField[] = meta.fields.map((field) => ({
    ...field,
    name: resolveName(field),
    options: normalizeOptions(field.options),
    rules: [
      ...(field.required ? [{ required: true }] : []),
      ...(Array.isArray(field.rules) ? field.rules : []),
    ],
    disabled: field.disabled ?? meta.disabled ?? false,
    widget: field.widget ?? 'input',
  }));
  return { ...meta, fields };
}
