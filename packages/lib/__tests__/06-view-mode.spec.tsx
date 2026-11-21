import { Form } from 'antd';
import { act, render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { useFormSchema } from '../src/useFormSchema';
import type {
  FormInstance,
  FormSchema,
  UseFormSchemaOptions,
  UseFormSchemaResult,
} from '../src/core/types';

type Captured = { form: FormInstance; result: UseFormSchemaResult };

function Harness({
  meta,
  capture,
  options,
}: {
  meta: FormSchema;
  capture: (value: Captured) => void;
  options?: UseFormSchemaOptions;
}) {
  const [form] = Form.useForm();
  const result = useFormSchema(meta, form, options);
  useEffect(() => {
    capture({ form, result });
  });
  return (
    <Form form={form} initialValues={meta.initialValues}>
      {result.visibleFields.map((field) => (
        <Form.Item key={field.key} {...field.props}>
          {field.control}
        </Form.Item>
      ))}
    </Form>
  );
}

describe('useFormSchema: view mode', () => {
  it('marks all fields as viewMode and renders values through read-only controls', () => {
    const meta: FormSchema = {
      viewMode: true,
      initialValues: { name: 'Alice' },
      fields: [{ key: 'name' }],
    };
    let captured!: Captured;
    const { container } = render(
      <Harness meta={meta} capture={(value) => { captured = value; }} />,
    );

    const field = captured.result.getField('name')!;
    expect(field.viewMode).toBe(true);
    expect(field.props.valuePropName).toBe('initialValue');
    expect(field.viewContent).toBeDefined();
    expect(container).toHaveTextContent('Alice');
  });

  it('shows the option label instead of the value for select fields', () => {
    const meta: FormSchema = {
      viewMode: true,
      initialValues: { role: 'admin' },
      fields: [{ key: 'role', widget: 'select', options: [['admin', 'Administrator']] }],
    };
    let captured!: Captured;
    const { container } = render(
      <Harness meta={meta} capture={(value) => { captured = value; }} />,
    );

    expect(container).toHaveTextContent('Administrator');
    expect(container).not.toHaveTextContent(/^admin$/);
    expect(captured.result.getField('role')?.options).toEqual([
      { value: 'admin', label: 'Administrator' },
    ]);
  });

  it('lets field-level viewMode:false override form-level viewMode:true', () => {
    const meta: FormSchema = {
      viewMode: true,
      fields: [{ key: 'name' }, { key: 'note', viewMode: false }],
    };
    let captured!: Captured;
    render(<Harness meta={meta} capture={(value) => { captured = value; }} />);

    expect(captured.result.getField('name')?.props.valuePropName).toBe('initialValue');
    const note = captured.result.getField('note')!;
    expect(note.viewMode).toBe(false);
    expect(note.props.valuePropName).not.toBe('initialValue');
  });

  it('renders a custom viewWidget escape hatch', () => {
    const CustomView = ({ initialValue }: { initialValue?: any }) => (
      <span data-testid="custom-view">CUSTOM:{initialValue}</span>
    );
    const meta: FormSchema = {
      viewMode: true,
      initialValues: { note: 'hello' },
      fields: [{ key: 'note', viewWidget: CustomView }],
    };
    let captured!: Captured;
    const { getByTestId } = render(
      <Harness meta={meta} capture={(value) => { captured = value; }} />,
    );

    expect(getByTestId('custom-view')).toBeInTheDocument();
    expect(getByTestId('custom-view')).toHaveTextContent('CUSTOM:hello');
    expect(captured.result.getField('note')?.viewMode).toBe(true);
  });

  it('does not change form values when toggling view mode', () => {
    const baseMeta: FormSchema = {
      initialValues: { name: 'Alice' },
      fields: [{ key: 'name' }],
    };
    const viewMeta: FormSchema = { ...baseMeta, viewMode: true };
    let captured!: Captured;
    const { rerender } = render(
      <Harness meta={baseMeta} capture={(value) => { captured = value; }} />,
    );

    act(() => {
      captured.form.setFieldsValue({ name: 'Bob' });
    });
    const before = captured.form.getFieldsValue();
    expect(before).toEqual({ name: 'Bob' });

    rerender(<Harness meta={viewMeta} capture={(value) => { captured = value; }} />);
    expect(captured.form.getFieldsValue()).toEqual(before);
  });
});
