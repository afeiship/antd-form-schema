import cx from 'classnames';
import { Form } from 'antd';
import type { FC, HTMLAttributes } from 'react';
import type { BoundField } from './types';

const CLASS_NAME = 'antd-form-schema';

export type FormFieldsProps = {
  fields: BoundField[];
} & HTMLAttributes<HTMLDivElement>;

type FormFieldsComponent = FC<FormFieldsProps> & { version?: string };

/** Thin convenience renderer: vertical divs plus Form.Item data binding. No layout props. */
const FormFields: FormFieldsComponent = ({ fields, className, ...rest }) => (
  <div data-component={CLASS_NAME} className={cx(CLASS_NAME, className)} {...rest}>
    {fields.filter((field) => field.visible).map((field) => (
      <div key={field.key}>
        <label>
          {field.label}
          {field.required && <span aria-hidden="true">*</span>}
        </label>
        <Form.Item {...field.itemProps} noStyle>
          {field.control}
        </Form.Item>
      </div>
    ))}
  </div>
);

FormFields.displayName = 'FormFields';
FormFields.version = __VERSION__;

export default FormFields;
