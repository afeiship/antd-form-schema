import { Form } from 'antd';
import type { FormProps } from 'antd';

/** className slots, keyed to match the rendered parts (`form` only applies to SchemaForm). */
export interface FormClassNames {
  /** The <Form> element — SchemaForm only; ineffective on SchemaFields. */
  form?: string;
  /** The Form.Item for one field. */
  field?: string;
  /** The label content wrapper inside Form.Item. */
  label?: string;
  /** The value-bound control. */
  control?: string;
}

/** Merge class strings without duplicates or stray whitespace. */
export function mergeClasses(...values: Array<string | undefined>): string | undefined {
  const merged = values.filter(Boolean).join(' ').trim();
  return merged || undefined;
}

/** Warn once per component instance when a classNames key has nowhere to apply. */
export function warnIneffectiveClassNames(form?: string): void {
  if (form) console.warn('classNames.form is ineffective on SchemaFields (no Form element).');
}

/** Convenience: pick the Form-level props out of a FormProps + classNames combination. */
export function formLevelProps(classNames?: FormClassNames): Pick<FormProps, 'className'> {
  return { className: classNames?.form };
}
