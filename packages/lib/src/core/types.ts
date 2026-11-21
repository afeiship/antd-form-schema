import type { ComponentType, ReactNode } from 'react';
import type { FormInstance, FormItemProps } from 'antd';
import type { Rule } from 'antd/es/form';
import type { NamePath } from 'antd/es/form/interface';

export type { NamePath, FormInstance, FormItemProps, Rule };

/** widget: string id (lookup in WIDGETS / widgets prop) or a component escape hatch. */
export type Widget = string | ComponentType<any>;

/** options in three shapes: plain string, [value,label] tuple, or full object. */
export type OptionInput =
  | string
  | [any, ReactNode]
  | { value: any; label?: ReactNode; disabled?: boolean; key?: any };

export interface NormalizedOption {
  value: any;
  label?: ReactNode;
  disabled?: boolean;
  key?: any;
}

/** Field contract: no layout or style keys. */
export interface FieldSchema {
  /** Unique id; without explicit name, split on '.' into a NamePath. */
  key: string;
  /** Data path; overrides key derivation. Use '!!!' prefix when the field name itself contains a dot. */
  name?: NamePath;
  /** Widget id, defaults to 'input'. */
  widget?: Widget;
  /** View-mode widget, defaults to 'span' (read-only text). */
  viewWidget?: Widget;
  /** Props passed to the widget, e.g. { mode: 'multiple' }. */
  widgetProps?: Record<string, any>;
  label?: ReactNode;
  /** Field-level className, applied to the Form.Item of this field. */
  className?: string;
  placeholder?: string;
  options?: OptionInput[];
  /** Required shortcut, converted to a required rule during normalize. */
  required?: boolean;
  /** Native antd validation rules, forwarded to Form.Item as-is. */
  rules?: Rule[];
  /** Declarative condition (recommended) or function escape hatch. */
  condition?: Condition | ConditionFn;
  initialValue?: any;
  disabled?: boolean;
  readOnly?: boolean;
  /** Field-level view mode overrides form-level. */
  viewMode?: boolean;
  /** Dependencies explicitly declared for function conditions (used by auto watch). */
  watch?: NamePath[];
  /** Native antd linkage, forwarded as-is. */
  dependencies?: NamePath[];
  shouldUpdate?: FormItemProps['shouldUpdate'];
  /** Extra Form.Item props merged over the derived data-binding props (e.g. `colon: false`). */
  itemProps?: Partial<FormItemProps>;
  valuePropName?: string;
  /** Form-level value type; date widgets convert outbound values. Default 'dayjs' (no conversion). */
  valueType?: 'dayjs' | 'string' | 'number' | 'timestamp';
  /** Format override, only meaningful with valueType 'string'. Default 'YYYY-MM-DD'. */
  valueFormat?: string;
  /** Converter id or ordered id chain; read runs forward, write backward. Mutually exclusive with valueType. */
  converter?: string | string[];
}

/** Context passed to a field converter. `values` is a read-only snapshot of the whole form. */
export interface ConverterContext {
  /** Current field, already normalized. */
  field: NormalizedField;
  /** Whole-form values snapshot; read only, never mutate. */
  values: Record<string, any>;
  /** Current schema; read only. */
  meta: FormSchema;
}

/** Per-field value adapter: stored value <-> control value. Both hooks must be pure. */
export interface FieldConverter {
  /** Stored value -> control value (display); passthrough when omitted. */
  read?: (value: any, ctx: ConverterContext) => any;
  /** Control value -> stored value (write-back); passthrough when omitted. */
  write?: (value: any, ctx: ConverterContext) => any;
}

/** Form contract: no layout or style keys. */
export interface FormSchema {
  name?: string;
  version?: string;
  viewMode?: boolean;
  disabled?: boolean;
  /** Whole-values transform applied before onFinish in SchemaForm. */
  normalizeValues?: (values: Record<string, any>) => Record<string, any>;
  initialValues?: Record<string, any>;
  /** Form-level converter defaults keyed by field key. A field's own `converter` wins. */
  converters?: Record<string, string | string[]>;
  fields: FieldSchema[];
}

/** Declarative condition operators. */
export type CompareOp =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'nin'
  | 'empty'
  | 'notEmpty'
  | 'includes';

export interface CompareCondition {
  field: NamePath;
  op: CompareOp;
  value?: any;
}

export interface LogicCondition {
  and?: Condition[];
  or?: Condition[];
  not?: Condition;
}

export type Condition = CompareCondition | LogicCondition;

export type ConditionFn = (ctx: { form: FormInstance; values: Record<string, any> }) => boolean;

export interface WidgetDef {
  component: ComponentType<any>;
  /** Converts a field into widget / Form.Item props. */
  metaConverter?: (ctx: { field: FieldSchema; meta: FormSchema }) => Partial<FieldSchema>;
}

/** Preset entry for one key: widget id shorthand, or an object carrying the widget. */
export type PresetField = string | { widget: Widget };

/** Sectioned presets: widget per key, and label text per locale. */
export interface PresetsInput {
  fields?: Record<string, PresetField>;
  labels?: Record<string, Record<string, string>>;
}

/** Presets prop: a sectioned file, or a flat single-language label table. */
export type Presets = PresetsInput | Record<string, string>;

export interface UseFormSchemaOptions {
  /** Local widget registrations / overrides, taking precedence over builtin widgets. */
  widgets?: Record<string, WidgetDef>;
  /** Meta validation switch, enabled in development by default. */
  validate?: boolean;
  /** Per-key presets: widget and locale-aware label. */
  presets?: Presets;
  /** Locale used to pick preset labels; defaults to 'zh-CN'. */
  locale?: string;
  /** Per-field converters, keyed by the id referenced from `FieldSchema.converter`. */
  converters?: Record<string, FieldConverter>;
}

export interface BoundField {
  key: string;
  name: NamePath;
  widget: string | Widget;
  label?: ReactNode;
  /** Field-level className, applied to the Form.Item of this field. */
  className?: string;
  valueType?: 'dayjs' | 'string' | 'number' | 'timestamp';
  valueFormat?: string;
  /** Converter id used by this field, exposed for debugging. */
  converter?: string | string[];
  placeholder?: string;
  options?: NormalizedOption[];
  required?: boolean;
  viewMode: boolean;
  disabled?: boolean;
  /** Field-level initialValue as passthrough data; the hook never seeds form state with it. */
  initialValue?: any;
  /** Condition result: false means the field should not be rendered. */
  visible: boolean;
  /** Form.Item props: data binding keys plus any `field.itemProps` overrides. */
  itemProps: FormItemProps;
  control: ReactNode;
  controlProps: Record<string, any>;
  WidgetComponent?: ComponentType<any>;
  viewContent?: ReactNode;
}

export interface Issue {
  level: 'error' | 'warning';
  message: string;
  field?: string;
  index?: number;
}

export interface UseFormSchemaResult {
  fields: BoundField[];
  visibleFields: BoundField[];
  getField(key: string): BoundField | undefined;
  issues: Issue[];
}

export type NormalizedField = FieldSchema & {
  name: NamePath;
  options: NormalizedOption[];
  rules: Rule[];
  disabled: boolean;
};

export type NormalizedMeta = Omit<FormSchema, 'fields'> & { fields: NormalizedField[] };
