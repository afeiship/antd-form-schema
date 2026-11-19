import { Form } from 'antd';
import type { FormProps, FormInstance } from 'antd';
import type { FC, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import SchemaFields from './SchemaFields';
import type { SchemaFieldsProps } from './SchemaFields';
import type { FormSlots } from './slots';

export interface SchemaFormProps extends Omit<FormProps, 'form' | 'initialValues'>, SchemaFieldsProps {
  onFormReady?: (form: FormInstance) => void;
  children?: ReactNode;
  slots?: FormSlots;
}

/** One-line form: creates its own Form instance and seeds it from meta.initialValues. */
const SchemaForm: FC<SchemaFormProps> = ({
  meta,
  widgets,
  className,
  itemClassName,
  labelClassName,
  controlClassName,
  slots,
  onFormReady,
  children,
  ...rest
}) => {
  const [form] = Form.useForm();
  const readyRef = useRef(false);
  useEffect(() => {
    if (onFormReady && !readyRef.current) {
      readyRef.current = true;
      onFormReady(form);
    }
  }, [form, onFormReady]);

  return (
    <Form {...rest} form={form} initialValues={meta.initialValues}>
      <SchemaFields
        meta={meta}
        widgets={widgets}
        className={className}
        itemClassName={itemClassName}
        labelClassName={labelClassName}
        controlClassName={controlClassName}
        slots={slots}
      />
      {children}
    </Form>
  );
};

export default SchemaForm;
