import { Input, InputNumber, DatePicker, Radio, Checkbox, Switch, Select } from 'antd';
import { createElement } from 'react';
import type { FC, ReactNode } from 'react';
import { normalizeOptions } from './utils';
import type {
  FieldSchema,
  FormSchema,
  NormalizedField,
  NormalizedOption,
  Widget,
  WidgetDef,
} from './types';

type Converter = Required<WidgetDef>['metaConverter'];
type ConverterContext = Parameters<Converter>[0];

const checkedConverter: Converter = () => ({ valuePropName: 'checked' });

/** Build option children with a stable key for each normalized option. */
function optionsChildren(
  field: FieldSchema,
  render: (option: NormalizedOption, key: any) => ReactNode,
): ReactNode[] {
  return normalizeOptions(field.options).map((option, index) =>
    render(option, option.key ?? option.value ?? index),
  );
}

const radioGroupConverter: Converter = ({ field }: ConverterContext) => ({
  widgetProps: {
    children: optionsChildren(field, (option, key) =>
      createElement(Radio, { key, value: option.value, disabled: option.disabled }, option.label),
    ),
  },
});

const checkboxGroupConverter: Converter = ({ field }: ConverterContext) => ({
  widgetProps: {
    children: optionsChildren(field, (option, key) =>
      createElement(
        Checkbox,
        { key, value: option.value, disabled: option.disabled },
        option.label,
      ),
    ),
  },
});

const selectConverter: Converter = ({ field }: ConverterContext) => ({
  widgetProps: {
    children: optionsChildren(field, (option, key) =>
      createElement(Select.Option, {
        key,
        value: option.value,
        disabled: option.disabled,
        children: option.label,
      }),
    ),
  },
});

/** Read-only text widget: consumes initialValue (set by Form.Item in view mode) and resolves option labels. */
export const ViewSpan: FC<{ initialValue?: any; options?: NormalizedOption[]; value?: any }> = ({
  initialValue,
  options,
  value,
}) => {
  const current = initialValue ?? value;
  if (current == null) return null;

  let content: ReactNode = current;
  if (options && options.length > 0) {
    const labelOf = (item: any) => {
      const found = options.find((option) => option.value === item);
      return found ? (found.label ?? item) : item;
    };
    content = Array.isArray(current)
      ? current.map(labelOf).join(', ')
      : labelOf(current);
  }
  // React omits boolean children, so render true/false explicitly.
  if (typeof content === 'boolean') content = String(content);
  return <span>{content}</span>;
};

export const WIDGETS: Record<string, WidgetDef> = {
  input: { component: Input },
  text: { component: Input },
  password: { component: Input.Password },
  textarea: { component: Input.TextArea },
  number: { component: InputNumber },
  'date-picker': { component: DatePicker },
  'date-time': {
    component: DatePicker,
    metaConverter: () => ({ widgetProps: { showTime: true } }),
  },
  radio: { component: Radio, metaConverter: checkedConverter },
  'radio-group': { component: Radio.Group, metaConverter: radioGroupConverter },
  checkbox: { component: Checkbox, metaConverter: checkedConverter },
  switch: { component: Switch, metaConverter: checkedConverter },
  'checkbox-group': { component: Checkbox.Group, metaConverter: checkboxGroupConverter },
  select: { component: Select, metaConverter: selectConverter },
  span: { component: ViewSpan },
};

/** Resolve a widget id (or component) with local overrides taking precedence. */
export function resolveWidget(
  widget: Widget | undefined,
  local?: Record<string, WidgetDef>,
): WidgetDef {
  if (widget === undefined) return WIDGETS.input;
  if (typeof widget !== 'string') return { component: widget as WidgetDef['component'] };
  return local?.[widget] ?? WIDGETS[widget] ?? WIDGETS.input;
}

/** Apply a widget's metadata converter, shallow-merging widgetProps. */
export function applyConverter(
  field: NormalizedField,
  def: WidgetDef,
  meta: FormSchema,
): NormalizedField {
  const patch = def.metaConverter?.({ field, meta }) ?? {};
  const result = { ...field, ...patch } as NormalizedField;
  if (field.widgetProps || patch.widgetProps) {
    result.widgetProps = { ...field.widgetProps, ...patch.widgetProps };
  }
  return result;
}
