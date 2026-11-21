import type {
  ConverterContext,
  FieldConverter,
  FormItemProps,
  FormSchema,
  NormalizedField,
} from './types';

// Bundler-safe: `process` is absent in browsers/runtimes that do not shim it.
const isDev = typeof process === 'undefined' || process.env.NODE_ENV !== 'production';

/** A resolved converter step: id kept for diagnostics, implementation for execution. */
export interface ResolvedConverter {
  id: string;
  converter: FieldConverter;
}

/** Normalize `string | string[] | undefined` into a clean id list. */
export function normalizeConverterIds(ref?: string | string[]): string[] {
  if (ref == null) return [];
  const ids = Array.isArray(ref) ? ref : [ref];
  return ids.filter((id) => typeof id === 'string' && id.length > 0);
}

/** Look up a single converter by id. Unknown ids are reported by validateMeta, not here. */
export function resolveConverter(
  id: string | undefined,
  registry?: Record<string, FieldConverter>,
): FieldConverter | undefined {
  if (!id) return undefined;
  return registry?.[id];
}

/** Resolve an ordered converter chain; unknown ids are skipped (validation owns reporting). */
export function resolveConverterChain(
  ref: string | string[] | undefined,
  registry?: Record<string, FieldConverter>,
): ResolvedConverter[] {
  return normalizeConverterIds(ref).flatMap((id) => {
    const converter = resolveConverter(id, registry);
    return converter ? [{ id, converter }] : [];
  });
}

/** Run a chain in one try/catch: read forward, write backward; failure falls back to the input. */
function runChain(
  chain: ResolvedConverter[],
  value: any,
  ctx: ConverterContext,
  direction: 'read' | 'write',
): any {
  const ordered = direction === 'write' ? [...chain].reverse() : chain;
  let current = value;
  let currentId: string | undefined;

  try {
    for (const step of ordered) {
      currentId = step.id;
      const fn = step.converter[direction];
      if (fn) current = fn(current, ctx);
    }
    return current;
  } catch (error) {
    if (isDev) {
      const ids = chain.map((step) => step.id).join(',');
      console.warn(
        `[antd-form-schema] converter chain "${ids}" failed at "${currentId}" on "${ctx.field.key}"`,
        error,
      );
    }
    return value;
  }
}

/** Extract the control value from antd change-event arguments. */
function extractControlValue(args: any[]): any {
  const first = args[0];
  if (first && typeof first === 'object' && 'target' in first) {
    const target = (first as any).target;
    if (target && target.type === 'checkbox') return target.checked;
    return target?.value;
  }
  return first;
}

/**
 * Wrap Form.Item value hooks with the converter chain.
 * Explicit `field.itemProps` is merged afterwards by the caller, so it always wins.
 */
export function applyFieldConverter(
  itemProps: FormItemProps,
  chain: ResolvedConverter[],
  ctx: ConverterContext,
  viewMode = false,
): FormItemProps {
  if (!chain.length) return itemProps;
  const result: FormItemProps = { ...itemProps };
  const valueKey = (result.valuePropName as string | undefined) ?? 'value';
  const previousGetValueProps = result.getValueProps;

  if (chain.some((step) => step.converter.read)) {
    result.getValueProps = (value: any) => {
      const base = previousGetValueProps ? previousGetValueProps(value) : {};
      return { ...base, [valueKey]: runChain(chain, value, ctx, 'read') };
    };
  }

  if (!viewMode && chain.some((step) => step.converter.write)) {
    const previousFromEvent = result.getValueFromEvent;
    result.getValueFromEvent = (...args: any[]) => {
      const raw = previousFromEvent ? (previousFromEvent as any)(...args) : extractControlValue(args);
      return runChain(chain, raw, ctx, 'write');
    };
  }

  return result;
}

/** Read a stored value for view-mode rendering, without touching Form.Item hooks. */
export function readConvertedValue(
  value: any,
  chain: ResolvedConverter[],
  field: NormalizedField,
  values: Record<string, any>,
  meta: FormSchema,
): any {
  if (!chain.length) return value;
  return runChain(chain, value, { field, values, meta }, 'read');
}
