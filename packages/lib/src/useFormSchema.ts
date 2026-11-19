import { Form } from 'antd';
import { createElement } from 'react';
import { getItemProps, getControlProps } from './bind';
import { evaluateCondition } from './condition';
import { normalizeMeta } from './normalize';
import { get } from './utils';
import { validateMeta } from './validate';
import { applyConverter, resolveWidget, WIDGETS } from './widgets';
import type {
  BoundField,
  FormInstance,
  FormSchema,
  Issue,
  UseFormSchemaOptions,
  UseFormSchemaResult,
} from './types';

const isDev = process.env.NODE_ENV !== 'production';

/** Single hook entry: subscribes to all form changes, derives bindable fields from the schema. */
export function useFormSchema(
  meta: FormSchema,
  form: FormInstance,
  options?: UseFormSchemaOptions,
): UseFormSchemaResult {
  const issues: Issue[] = [];
  if (options?.validate !== false && isDev) {
    const mergedWidgets = { ...WIDGETS, ...options?.widgets };
    issues.push(...validateMeta(meta, mergedWidgets));
    for (const issue of issues) {
      console.warn(issue.message);
    }
    const unregistered = issues.find((issue) => issue.message.startsWith('unregistered widget '));
    if (unregistered) {
      throw new Error(unregistered.message);
    }
  }

  const normalized = normalizeMeta(meta);
  // Watch-all is intentional: useWatch returns only a rerender trigger, values are read fresh below.
  Form.useWatch([], form);
  const values = form.getFieldsValue(true);

  const fields: BoundField[] = normalized.fields.map((field): BoundField => {
    const visible = field.condition
      ? evaluateCondition(field.condition, { form, values })
      : true;
    const def = resolveWidget(field.widget, options?.widgets);
    const converted = applyConverter(field, def, meta);
    const isView = field.viewMode ?? meta.viewMode ?? false;
    const viewDef = isView
      ? resolveWidget(field.viewWidget ?? 'span', options?.widgets)
      : undefined;
    const renderField = viewDef ? applyConverter(converted, viewDef, meta) : converted;
    const WidgetComponent = viewDef ? viewDef.component : def.component;

    const itemProps = getItemProps(converted, {
      valuePropName: isView ? 'initialValue' : converted.valuePropName,
    });
    const controlProps = getControlProps(converted);
    const renderProps = viewDef
      ? { ...getControlProps(renderField), initialValue: get(values, converted.name) }
      : controlProps;
    const control = createElement(WidgetComponent, renderProps);

    return {
      key: field.key,
      name: converted.name,
      widget: field.widget ?? 'input',
      label: field.label,
      placeholder: field.placeholder,
      options: converted.options,
      required: field.required,
      disabled: converted.disabled,
      viewMode: isView,
      visible,
      itemProps,
      control,
      controlProps,
      WidgetComponent,
      viewContent: isView ? control : undefined,
    };
  });

  return {
    fields,
    visibleFields: fields.filter((field) => field.visible),
    getField: (key) => fields.find((field) => field.key === key),
    issues,
  };
}
