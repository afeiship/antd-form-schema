import { Form } from 'antd';
import type { FormProps, FormInstance } from 'antd';
import type { FC, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import SchemaFields from './SchemaFields';
import type { SchemaFieldsProps } from './SchemaFields';
import type { FormSlots } from './slots';

export interface SchemaFormProps extends Omit<FormProps, 'form' | 'initialValues' | 'className'>, SchemaFieldsProps {
  onFormReady?: (form: FormInstance) => void;
  children?: ReactNode;
  slots?: FormSlots;
  /** Whole-values transform applied before onFinish; wins over meta.normalizeValues. */
  normalizeValues?: (values: Record<string, any>) => Record<string, any>;
}

/** One-line form: creates its own Form instance and seeds it from meta.initialValues. */
const SchemaForm: FC<SchemaFormProps> = ({
  meta,
  widgets,
  classNames,
  slots,
  onFormReady,
  normalizeValues,
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

  const { form: formClass, ...fieldClassNames } = classNames ?? {};
  const normalize = normalizeValues ?? meta.normalizeValues;
  const userOnFinish = rest.onFinish;
  const handleFinish: FormProps['onFinish'] = (values) => {
    const finalValues = normalize ? normalize(values as Record<string, any>) : values;
    (userOnFinish as any)?.(finalValues);
  };

  return (
    <Form
      {...rest}
      onFinish={handleFinish}
      form={form}
      initialValues={meta.initialValues}
      className={formClass}
    >
      <SchemaFields meta={meta} widgets={widgets} classNames={fieldClassNames} slots={slots} />
      {children}
    </Form>
  );
};

export default SchemaForm;
