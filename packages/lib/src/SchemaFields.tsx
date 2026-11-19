import { Form } from 'antd';
import type { FC } from 'react';
import { useFormSchema } from './useFormSchema';
import type { FormSchema, WidgetDef } from './types';

export interface SchemaFieldsProps {
  meta: FormSchema;
  widgets?: Record<string, WidgetDef>;
  className?: string;
  itemClassName?: string;
  labelClassName?: string;
  controlClassName?: string;
}

/** Field renderer: reads the form from context, renders a className-driven grid of labelled fields. */
const SchemaFields: FC<SchemaFieldsProps> = ({
  meta,
  widgets,
  className,
  itemClassName,
  labelClassName,
  controlClassName,
}) => {
  const form = Form.useFormInstance();
  if (!form) throw new Error('SchemaFields must be used inside a <Form>.');
  const { visibleFields } = useFormSchema(meta, form, { widgets });

  return (
    <div className={className}>
      {visibleFields.map((field) => (
        <div className={itemClassName} key={field.key}>
          <label className={labelClassName}>
            {field.label}
            {field.required && <span aria-hidden="true"> *</span>}
          </label>
          <div className={controlClassName}>
            <Form.Item {...field.itemProps}>{field.control}</Form.Item>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SchemaFields;
