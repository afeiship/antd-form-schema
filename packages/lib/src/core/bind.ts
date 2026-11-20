import type { FormItemProps, NamePath, NormalizedField } from './types';

type ItemExtras = {
  valuePropName?: string;
  dependencies?: NamePath[];
  shouldUpdate?: FormItemProps['shouldUpdate'];
};

/** Build Form.Item props containing data-binding keys only (no label / className / style). */
export function getItemProps(field: NormalizedField, extras?: ItemExtras): FormItemProps {
  const props: Record<string, any> = {
    name: field.name,
    rules: field.rules,
    valuePropName: extras?.valuePropName,
    dependencies: field.dependencies ?? extras?.dependencies,
    shouldUpdate: field.shouldUpdate ?? extras?.shouldUpdate,
  };
  for (const key of Object.keys(props)) {
    if (props[key] === undefined) delete props[key];
  }
  return props as FormItemProps;
}

/** Build widget props from the normalized field; extras win over field values. */
export function getControlProps(field: NormalizedField, extras?: Record<string, any>): Record<string, any> {
  return {
    options: field.options,
    placeholder: field.placeholder,
    disabled: field.disabled,
    readOnly: field.readOnly,
    ...field.widgetProps,
    ...extras,
  };
}
