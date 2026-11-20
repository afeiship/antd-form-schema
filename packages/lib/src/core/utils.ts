import type { FieldSchema, NamePath, NormalizedOption, OptionInput } from './types';

/** Convert a schema key into a NamePath. '!!!' keeps the rest as one literal segment. */
export function toNamePath(key: string): NamePath {
  if (key.startsWith('!!!')) return [key.slice(3)];
  return key.split('.');
}

/** Explicit name always wins over key derivation. */
export function resolveName(field: FieldSchema): NamePath {
  return field.name ?? toNamePath(field.key);
}

/** Read a nested value by string or NamePath; undefined on any missing level. */
export function get(values: any, path: NamePath): any {
  if (values == null) return undefined;
  const parts: NamePath = typeof path === 'string' ? toNamePath(path) : path;
  let current = values;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part as any];
  }
  return current;
}

/** Whether a path exists (a value of undefined counts as absent). */
export function has(values: any, path: NamePath): boolean {
  if (values == null) return false;
  const parts: NamePath = typeof path === 'string' ? toNamePath(path) : path;
  let current = values;
  for (const part of parts) {
    if (current == null || !((part as any) in Object(current))) return false;
    current = current[part as any];
  }
  return current !== undefined;
}

/** Deduplicate paths by their JSON representation. */
export function uniqPaths(paths: NamePath[]): NamePath[] {
  const seen = new Set<string>();
  const result: NamePath[] = [];
  for (const path of paths) {
    const id = JSON.stringify(path);
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(path);
  }
  return result;
}

/** Normalize string / tuple / object options into a uniform array. */
export function normalizeOptions(options?: OptionInput[]): NormalizedOption[] {
  if (!options) return [];
  return options.map((option) => {
    if (typeof option === 'string') return { value: option, label: option };
    if (Array.isArray(option)) return { value: option[0], label: option[1] };
    return option;
  });
}
