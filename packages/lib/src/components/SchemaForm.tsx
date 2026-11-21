import { Form, Spin } from 'antd';
import type { FormProps, FormInstance } from 'antd';
import type { FC, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import SchemaFields from './SchemaFields';
import type { SchemaFieldsProps } from './SchemaFields';
import type { FormSlots } from './slots';
import { useResolvedMeta } from './use-resolved-meta';

export interface SchemaFormProps extends Omit<FormProps, 'form' | 'initialValues' | 'className'>, SchemaFieldsProps {
  onFormReady?: (form: FormInstance) => void;
  children?: ReactNode;
  slots?: FormSlots;
  /** Whole-values transform applied before onFinish; wins over meta.normalizeValues. */
  normalizeValues?: (values: Record<string, any>) => Record<string, any>;
  /** Placeholder while async meta is pending; pass null to render nothing (default: antd Spin). */
  loading?: ReactNode;
  /** Placeholder when async meta rejects (default: nothing). */
  error?: ReactNode;
}

/** Render a placeholder node or fall back to the given default. */
function renderPlaceholder(node: ReactNode | undefined, fallback: ReactNode): ReactNode {
  return node === undefined ? fallback : node;
}

/** One-line form: creates its own Form instance and seeds it from meta.initialValues. */
const SchemaForm: FC<SchemaFormProps> = ({
  meta,
  widgets,
  classNames,
  slots,
  presets,
  locale,
  converters,
  onFormReady,
  normalizeValues,
  loading,
  error,
  children,
  ...rest
}) => {
  const { meta: resolved, error: resolvedError, pending } = useResolvedMeta(meta);
  const [form] = Form.useForm();
  const readyRef = useRef(false);
  useEffect(() => {
    if (onFormReady && !readyRef.current && resolved) {
      readyRef.current = true;
      onFormReady(form);
    }
  }, [form, onFormReady, resolved]);

  if (pending) return renderPlaceholder(loading, <Spin />);
  if (resolvedError) return renderPlaceholder(error, null);
  const activeMeta = resolved!;

  const { form: formClass, ...fieldClassNames } = classNames ?? {};
  const normalize = normalizeValues ?? activeMeta.normalizeValues;
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
      initialValues={activeMeta.initialValues}
      className={formClass}
    >
      <SchemaFields
        meta={activeMeta}
        widgets={widgets}
        classNames={fieldClassNames}
        slots={slots}
        presets={presets}
        locale={locale}
        converters={converters}
      />
      {children}
    </Form>
  );
};

export default SchemaForm;
