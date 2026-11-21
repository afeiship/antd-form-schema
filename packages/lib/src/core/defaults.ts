import type { PresetField, Presets, PresetsInput, SchemaFormDefaults } from './types';

let globalDefaults: SchemaFormDefaults = {};

/** Replace the project-level defaults with a shallow merge of the provided fields. */
export function configureSchemaForm(defaults: SchemaFormDefaults): void {
  const next: SchemaFormDefaults = { ...globalDefaults };
  if (defaults.presets !== undefined) next.presets = defaults.presets;
  if (defaults.converters !== undefined) next.converters = defaults.converters;
  if (defaults.locale !== undefined) next.locale = defaults.locale;
  globalDefaults = next;
}

/** Snapshot of the active project-level defaults. */
export function getSchemaFormDefaults(): SchemaFormDefaults {
  return { ...globalDefaults };
}

/** Clear every project-level default. Intended for tests and HMR. */
export function resetSchemaFormDefaults(): void {
  globalDefaults = {};
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Sectioned presets (has `fields` / `labels`) vs flat label table. */
function isSectioned(presets: Presets): presets is PresetsInput {
  return isPlainObject(presets) && ('fields' in presets || 'labels' in presets);
}

/** A flat label table is shorthand for a zh-CN label map. */
function normalizePresets(presets?: Presets): PresetsInput {
  if (!presets) return {};
  if (isSectioned(presets)) {
    return {
      fields: presets.fields,
      labels: presets.labels,
    };
  }
  return { labels: { 'zh-CN': presets } };
}

function mergeLabels(
  base: Record<string, Record<string, string>> = {},
  override: Record<string, Record<string, string>> = {},
): Record<string, Record<string, string>> {
  const locales = new Set([...Object.keys(base), ...Object.keys(override)]);
  const result: Record<string, Record<string, string>> = {};
  for (const locale of locales) {
    result[locale] = { ...base[locale], ...override[locale] };
  }
  return result;
}

/**
 * Merge project-level and form-level presets.
 * Fields merge per key and labels merge per locale; form-level entries win.
 */
export function mergePresets(globalPresets?: Presets, localPresets?: Presets): Presets | undefined {
  if (!globalPresets) return localPresets;
  if (!localPresets) return globalPresets;

  const base = normalizePresets(globalPresets);
  const local = normalizePresets(localPresets);
  const fields: Record<string, PresetField> = { ...base.fields, ...local.fields };

  return {
    fields,
    labels: mergeLabels(base.labels, local.labels),
  };
}
