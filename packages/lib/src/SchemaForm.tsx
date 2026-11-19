import { Form } from 'antd';
import type { FormProps, FormInstance } from 'antd';
import type { FC, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import SchemaFields from './SchemaFields';
import type { SchemaFieldsProps } from './SchemaFields';

export interface SchemaFormProps extends Omit<FormProps, 'form'>, SchemaFieldsProps {
  onFormReady?: (form: FormInstance) => void;
  children?: ReactNode;
}

/** One-line form: creates its own Form instance and seeds it from meta.initialValues. */
const SchemaForm: FC<SchemaFormProps> = ({
  meta,
  widgets,
  className,
  itemClassName,
  labelClassName,
  controlClassName,
  onFormReady,
  children,
  ...rest
}) => {
  const [form] = Form.useForm();
  const readyRef = useRef(false);
  useEffect(() => {
    if (!readyRef.current) {
      readyRef.current = true;
      onFormReady?.(form);
    }
  }, [form, onFormReady]);

  return (
    <Form form={form} initialValues={meta.initialValues} {...rest}>
      <SchemaFields
        meta={meta}
        widgets={widgets}
        className={className}
        itemClassName={itemClassName}
        labelClassName={labelClassName}
        controlClassName={controlClassName}
      />
      {children}
    </Form>
  );
};

export default SchemaForm;
