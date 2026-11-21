import { Form } from 'antd';
import { createElement, useMemo } from 'react';
import { getControlProps, getItemProps, getValueFromEvent } from './core/bind';
import { evaluateCondition } from './core/condition';
import { applyFieldConverter, readConvertedValue, resolveConverterChain } from './core/converters';
import { getSchemaFormDefaults, mergePresets } from './core/defaults';
import { normalizeMeta } from './core/normalize';
import { applyPresets } from './core/presets';
import { get } from './core/utils';
import { validateMeta } from './core/validate';
import { applyConverter, resolveWidget, WIDGETS } from './widgets';
import type {
  BoundField,
  FormInstance,
  FormSchema,
  Issue,
  UseFormSchemaOptions,
  UseFormSchemaResult,
} from './core/types';

// Bundler-safe: `process` is absent in browsers/runtimes that do not shim it.
const isDev = typeof process === 'undefined' || process.env.NODE_ENV !== 'production';

/** Single hook entry: subscribes to all form changes, derives bindable fields from the schema. */
export function useFormSchema(
  meta: FormSchema,
  form: FormInstance,
  options?: UseFormSchemaOptions,
): UseFormSchemaResult {
  const validate = options?.validate;
  const widgets = options?.widgets;
  const presets = useMemo(
    () => mergePresets(getSchemaFormDefaults().presets, options?.presets),
    [options?.presets],
  );
  const locale = options?.locale ?? getSchemaFormDefaults().locale ?? 'zh-CN';
  const converters = useMemo(() => {
    const defaults = getSchemaFormDefaults().converters;
    if (!defaults && !options?.converters) return undefined;
    return { ...defaults, ...options?.converters };
  }, [options?.converters]);

  // Presets merge before validation so a bad preset widget id is caught by validateMeta.
  const activeMeta = useMemo(
    () => applyPresets(meta, presets, locale),
    [meta, presets, locale],
  );

  const issues: Issue[] = useMemo(() => {
    const found: Issue[] = [];
    if (validate !== false && isDev) {
      const mergedWidgets = { ...WIDGETS, ...widgets };
      found.push(...validateMeta(activeMeta, mergedWidgets, converters));
      for (const issue of found) {
        console.warn(issue.message);
      }
      const fatal = found.find(
        (issue) =>
          issue.message.startsWith('unregistered widget ') ||
          issue.message.startsWith('unregistered viewWidget ') ||
          issue.message.startsWith('unregistered converter '),
      );
      if (fatal) {
        throw new Error(fatal.message);
      }
    }
    return found;
  }, [activeMeta, validate, widgets, converters]);

  const normalized = normalizeMeta(activeMeta);
  // Watch-all is intentional: useWatch returns only a rerender trigger, values are read fresh below.
  Form.useWatch([], form);
  const values = form.getFieldsValue(true);

  const fields: BoundField[] = normalized.fields.map((field): BoundField => {
    const visible = !field.hidden && (field.condition
      ? evaluateCondition(field.condition, { form, values })
      : true);
    const def = resolveWidget(field.widget, options?.widgets);
    const converted = applyConverter(field, def, meta);
    const isView = meta.viewMode === true ? true : (field.viewMode ?? false);
    const viewDef = isView
      ? resolveWidget(field.viewWidget ?? 'span', options?.widgets)
      : undefined;
    const renderField = viewDef ? applyConverter(converted, viewDef, meta) : converted;
    const WidgetComponent = viewDef ? viewDef.component : def.component;
    const converterRef = converted.converter ?? activeMeta.converters?.[converted.key];
    const chain = resolveConverterChain(converterRef, converters);
    const converterCtx = chain.length
      ? { field: converted, values, meta: activeMeta }
      : undefined;

    let props = getItemProps(converted, {
      valuePropName: isView ? 'initialValue' : converted.valuePropName,
    });
    if (chain.length && converterCtx) {
      props = applyFieldConverter(props, chain, converterCtx, isView);
    }
    if (converted.itemProps) Object.assign(props, converted.itemProps);
    // Built in: widgets may emit a value or an event-like `{ target: { value } }`.
    // A custom field-level getValueFromEvent always wins.
    if (!props.getValueFromEvent) {
      props.getValueFromEvent = getValueFromEvent(props.valuePropName ?? 'value');
    }
    const controlProps = getControlProps(converted);
    const storedValue = get(values, converted.name);
    const viewValue = readConvertedValue(storedValue, chain, converted, values, activeMeta);
    const renderProps = viewDef
      ? {
          ...getControlProps(renderField),
          ...(converted.viewProps ?? {}),
          initialValue: viewValue,
        }
      : controlProps;
    // `options` would leak onto a native input's DOM; drop it in edit mode.
    // View widgets (e.g. ViewSpan) need options to resolve enum labels, so keep it there.
    const elementProps = viewDef
      ? renderProps
      : (({ options: _options, ...rest }) => rest)(renderProps);
    const control = createElement(WidgetComponent, elementProps);

    return {
      key: field.key,
      name: converted.name,
      widget: field.widget ?? 'input',
      label: field.label,
      className: field.className,
      valueType: field.valueType,
      valueFormat: field.valueFormat,
      converter: converterRef,
      placeholder: field.placeholder,
      options: converted.options,
      required: field.required,
      disabled: converted.disabled,
      viewMode: isView,
      viewSpan: converted.viewSpan,
      viewProps: converted.viewProps,
      hidden: field.hidden,
      visible,
      itemProps: props,
      control,
      controlProps,
      initialValue: converted.initialValue,
      WidgetComponent,
      viewContent: isView ? control : undefined,
    };
  });

  return {
    fields,
    visibleFields: fields.filter((field) => field.visible),
    renderableFields: fields.filter((field) => field.visible || field.hidden),
    getField: (key) => fields.find((field) => field.key === key),
    issues,
  };
}
