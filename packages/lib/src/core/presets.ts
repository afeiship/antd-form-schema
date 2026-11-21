import { BUILTIN_LABELS } from './builtin-labels';
import type { FieldSchema, FormSchema, PresetField, Presets, PresetsInput, Widget } from './types';

const DEFAULT_LOCALE = 'zh-CN';

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Sectioned file (has `fields` / `labels`) vs flat label table. */
function isSectioned(presets: Presets): presets is PresetsInput {
  return isPlainObject(presets) && ('fields' in presets || 'labels' in presets);
}

/** Full key first, then its last dot-segment. */
function pickEntry<T>(table: Record<string, T> | undefined, key: string): T | undefined {
  if (!table) return undefined;
  if (table[key] !== undefined) return table[key];
  const last = key.split('.').pop();
  if (!last || last === key) return undefined;
  return table[last];
}

function widgetOf(entry: PresetField | undefined): Widget | undefined {
  if (!entry) return undefined;
  return typeof entry === 'string' ? entry : entry.widget;
}

/** locale → zh-CN → builtin (same order) → key itself. */
function resolveLabel(
  key: string,
  locale: string,
  labels: Record<string, Record<string, string>>,
): string {
  const chain = locale === DEFAULT_LOCALE ? [DEFAULT_LOCALE] : [locale, DEFAULT_LOCALE];
  for (const loc of chain) {
    const value = pickEntry(labels[loc], key);
    if (value !== undefined) return value;
  }
  for (const loc of chain) {
    const value = pickEntry(BUILTIN_LABELS[loc], key);
    if (value !== undefined) return value;
  }
  return key;
}

/**
 * Merge per-key presets into the schema without mutating the input.
 * Explicit schema `widget` / `label` always win; presets only fill the gaps.
 * Keys present in presets but absent from the schema are ignored (presets never create fields).
 */
export function applyPresets(
  meta: FormSchema,
  presets?: Presets,
  locale = DEFAULT_LOCALE,
): FormSchema {
  if (!presets) return meta;

  const sectioned = isSectioned(presets);
  const fields = sectioned ? presets.fields : undefined;
  // A flat table is treated as the default-locale label map.
  const labels = sectioned ? presets.labels ?? {} : { [DEFAULT_LOCALE]: presets };

  const mergedFields: FieldSchema[] = meta.fields.map((field) => {
    const presetWidget = widgetOf(pickEntry(fields, field.key));
    return {
      ...field,
      widget: field.widget ?? presetWidget,
      label: field.label ?? resolveLabel(field.key, locale, labels),
    };
  });

  return { ...meta, fields: mergedFields };
}
