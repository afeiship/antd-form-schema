import type { Slot } from '@jswork/react-list';
import type { Key, ReactNode } from 'react';
import type { BoundField } from './types';

export type FieldCtx = { field: BoundField };

/** Component-level slots for the parts of a rendered field that antd Form.Item does not own. */
export interface FormSlots {
  /** Overrides the Form.Item label content (antd still renders the <label htmlFor> and required mark). */
  label?: Slot<FieldCtx>;
  /** Overrides the Form.Item children (the value-bound control). */
  control?: Slot<FieldCtx & { control: ReactNode }>;
  /** Overrides the wrapper div around the whole Form.Item. */
  field?: Slot<FieldCtx & { children: ReactNode }>;
}

export type LabelProps = FieldCtx;
export type FieldProps = FieldCtx & { children: ReactNode; className?: string; key?: Key };
export type ControlProps = FieldCtx & { control: ReactNode };

/** Default label content: the field's text (antd renders the <label> and required mark). */
export const renderLabel = ({ field }: LabelProps) => field.label;

/** Default field wrapper: className-driven item div. */
export const renderField = ({ children, className, key }: FieldProps) => (
  <div className={className} key={key}>
    {children}
  </div>
);

/** Default control: the control element produced by the widget (antd Form.Item injects the id). */
export const renderControl = ({ control }: ControlProps) => control;
