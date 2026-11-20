import cx from 'classnames';
import { Form } from 'antd';
import type { FC, HTMLAttributes } from 'react';
import type { BoundField } from '../core/types';

const CLASS_NAME = 'antd-form-schema';

export type FormFieldsProps = {
  fields: BoundField[];
} & HTMLAttributes<HTMLDivElement>;

type FormFieldsComponent = FC<FormFieldsProps> & { version?: string };

/** Thin convenience renderer: antd Form.Item owns label, required mark and errors. */
const FormFields: FormFieldsComponent = ({ fields, className, ...rest }) => (
  <div data-component={CLASS_NAME} className={cx(CLASS_NAME, className)} {...rest}>
    {fields.filter((field) => field.visible).map((field) => (
      <div key={field.key}>
        <Form.Item {...field.itemProps} label={field.label} required={field.required}>
          {field.control}
        </Form.Item>
      </div>
    ))}
  </div>
);

FormFields.displayName = 'FormFields';
FormFields.version = __VERSION__;

export default FormFields;
