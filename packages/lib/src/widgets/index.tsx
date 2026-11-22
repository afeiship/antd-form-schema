import { Input, InputNumber, DatePicker, Radio, Checkbox, Switch, Select } from 'antd';
import dayjs from 'dayjs';
import { createElement } from 'react';
import type { FC, ReactNode } from 'react';
import { normalizeOptions } from '../core/utils';
import type {
  FieldSchema,
  FormSchema,
  NormalizedField,
  NormalizedOption,
  Widget,
  WidgetDef,
  WidgetInput,
} from '../core/types';

type Converter = Required<WidgetDef>['metaConverter'];
type ConverterContext = Parameters<Converter>[0];

const checkedConverter: Converter = () => ({ valuePropName: 'checked' });

/** Map a scalar or array value, passing null/undefined through untouched. */
function mapOrNull<T, R>(value: T | T[], fn: (v: T) => R): R | R[] | T | T[] {
  if (value == null) return value;
  return Array.isArray(value) ? value.map(fn) : fn(value);
}

/** Date widgets: convert stored form values per field.valueType ('dayjs' = untouched). */
const dateConverter: Converter = ({ field }: ConverterContext) => {
  const widgetProps: Record<string, any> = {};
  const props: Record<string, any> = {};
  if (field.valueType === 'string' || field.valueType === 'timestamp' || field.valueType === 'number') {
    const isString = field.valueType === 'string';
    const format = field.valueFormat ?? 'YYYY-MM-DD';
    // Outbound: rc-field-form calls getValueFromEvent(args) BEFORE dispatching to the
    // store, so this (not an onChange wrapper) is the only hook that actually converts.
    props.getValueFromEvent = (value: any) => {
      if (value == null) return value;
      if (isString) {
        return Array.isArray(value) ? value.map((v) => (v == null ? v : dayjs(v).format(format))) : dayjs(value).format(format);
      }
      return Array.isArray(value) ? value.map((v) => (v == null ? v : dayjs(v).valueOf())) : dayjs(value).valueOf();
    };
    // Inbound (Form.Item): stored string/ms -> dayjs so the picker can render it.
    props.getValueProps = (value: any) => ({
      value: mapOrNull(value, (v) => (isString ? dayjs(v, format) : dayjs(Number(v)))),
    });
  }
  return { widgetProps, itemProps: props };
};

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
  'date-picker': { component: DatePicker, metaConverter: dateConverter },
  'date-time': {
    component: DatePicker,
    metaConverter: (ctx) => {
      const converted = dateConverter(ctx);
      return {
        widgetProps: { showTime: true, ...converted.widgetProps },
        itemProps: converted.itemProps,
      };
    },
  },
  radio: { component: Radio, metaConverter: checkedConverter },
  'radio-group': { component: Radio.Group, metaConverter: radioGroupConverter },
  checkbox: { component: Checkbox, metaConverter: checkedConverter },
  switch: { component: Switch, metaConverter: checkedConverter },
  'checkbox-group': { component: Checkbox.Group, metaConverter: checkboxGroupConverter },
  select: { component: Select, metaConverter: selectConverter },
  span: { component: ViewSpan },
};

/** Normalize a registry entry: bare component → { component }, definition object passes through. */
export function normalizeWidgetDef(entry: WidgetInput): WidgetDef {
  if (typeof entry === 'function') return { component: entry };
  return entry;
}

/** Merge global and local registries per id; local wins. Entries are normalized to WidgetDef. */
export function mergeWidgets(
  global?: Record<string, WidgetInput>,
  local?: Record<string, WidgetInput>,
): Record<string, WidgetDef> {
  const merged: Record<string, WidgetDef> = {};
  if (global) {
    for (const [id, entry] of Object.entries(global)) merged[id] = normalizeWidgetDef(entry);
  }
  if (local) {
    for (const [id, entry] of Object.entries(local)) merged[id] = normalizeWidgetDef(entry);
  }
  return merged;
}

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
  if (patch.itemProps) {
    result.itemProps = { ...result.itemProps, ...patch.itemProps };
  }
  return result;
}
