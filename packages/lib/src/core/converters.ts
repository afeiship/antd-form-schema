import type {
  ConverterContext,
  FieldConverter,
  FormItemProps,
  FormSchema,
  NormalizedField,
} from './types';

// Bundler-safe: `process` is absent in browsers/runtimes that do not shim it.
const isDev = typeof process === 'undefined' || process.env.NODE_ENV !== 'production';

/** Look up a converter by id. Unknown ids are reported by validateMeta, not here. */
export function resolveConverter(
  id: string | undefined,
  registry?: Record<string, FieldConverter>,
): FieldConverter | undefined {
  if (!id) return undefined;
  return registry?.[id];
}

/** Run one converter hook; a throwing converter must never break the form. */
function callConverter(
  fn: (value: any, ctx: ConverterContext) => any,
  value: any,
  ctx: ConverterContext,
  direction: 'read' | 'write',
): any {
  try {
    return fn(value, ctx);
  } catch (error) {
    if (isDev) {
      console.warn(`[antd-form-schema] converter ${direction} failed on "${ctx.field.key}"`, error);
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
 * Wrap Form.Item value hooks with the field converter.
 * Explicit `field.itemProps` is merged afterwards by the caller, so it always wins.
 */
export function applyFieldConverter(
  itemProps: FormItemProps,
  converter: FieldConverter,
  ctx: ConverterContext,
  viewMode = false,
): FormItemProps {
  if (!converter) return itemProps;
  const result: FormItemProps = { ...itemProps };
  const valueKey = (result.valuePropName as string | undefined) ?? 'value';
  const previousGetValueProps = result.getValueProps;

  if (converter.read) {
    result.getValueProps = (value: any) => {
      const base = previousGetValueProps ? previousGetValueProps(value) : {};
      return { ...base, [valueKey]: callConverter(converter.read!, value, ctx, 'read') };
    };
  }

  if (!viewMode && converter.write) {
    const previousFromEvent = result.getValueFromEvent;
    result.getValueFromEvent = (...args: any[]) => {
      const raw = previousFromEvent ? (previousFromEvent as any)(...args) : extractControlValue(args);
      return callConverter(converter.write!, raw, ctx, 'write');
    };
  }

  return result;
}

/** Read a stored value for view-mode rendering, without touching Form.Item hooks. */
export function readConvertedValue(
  value: any,
  converter: FieldConverter | undefined,
  field: NormalizedField,
  values: Record<string, any>,
  meta: FormSchema,
): any {
  if (!converter?.read) return value;
  return callConverter(converter.read, value, { field, values, meta }, 'read');
}
