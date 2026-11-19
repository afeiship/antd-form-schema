import { Form } from 'antd';
import type { Slot } from '@jswork/react-list';
import { cloneElement, isValidElement } from 'react';
import type { Key, ReactNode } from 'react';
import type { BoundField, FormItemProps } from './types';

export type FieldCtx = { field: BoundField };

/** Resolve the DOM id for a field: respect an explicit control id, otherwise derive a stable one. */
export function fieldDomId(field: BoundField, control?: ReactNode): string {
  if (isValidElement(control) && control.props?.id) return String(control.props.id);
  const raw = Array.isArray(field.name)
    ? field.name.join('_')
    : String(field.name ?? field.key);
  return `afs_${raw.replace(/[^\w-]/g, '_')}`;
}

/** Inject a DOM id into the control when it has none, so the label can focus it. */
export function withFieldId(field: BoundField, control: ReactNode): ReactNode {
  if (!isValidElement(control)) return control;
  const id = fieldDomId(field, control);
  return control.props.id === id ? control : cloneElement(control as React.ReactElement<any>, { id });
}

/** Component-level slots for the four parts of a rendered field. */
export interface FormSlots {
  label?: Slot<FieldCtx>;
  field?: Slot<FieldCtx & { children: ReactNode }>;
  control?: Slot<FieldCtx & { control: ReactNode; itemProps: FormItemProps }>;
  error?: Slot<FieldCtx & { errors: string[] }>;
}

export type LabelProps = FieldCtx & { className?: string };
export type FieldProps = FieldCtx & { children: ReactNode; className?: string; key?: Key };
export type ControlProps = FieldCtx & { control: ReactNode; itemProps: FormItemProps; className?: string };
export type ErrorProps = FieldCtx & { errors: string[] };

/** Default label: mirrors the previous className-driven label markup. */
export const renderLabel = ({ field, className }: LabelProps) => (
  <label htmlFor={fieldDomId(field)} className={className}>
    {field.label}
    {field.required && <span aria-hidden="true"> *</span>}
  </label>
);

/** Default field wrapper: mirrors the previous className-driven item div. */
export const renderField = ({ children, className, key }: FieldProps) => (
  <div className={className} key={key}>
    {children}
  </div>
);

/** Default control: binding only (`noStyle`); errors are rendered by the error part. */
export const renderControl = ({ field, control, itemProps, className }: ControlProps) => (
  <div className={className}>
    <Form.Item {...itemProps} noStyle>
      {withFieldId(field, control)}
    </Form.Item>
  </div>
);

/** Default error: simple alert text, no antd style classes. */
export const renderError = ({ errors }: ErrorProps) =>
  errors.length > 0 ? <div role="alert">{errors.join(', ')}</div> : null;
