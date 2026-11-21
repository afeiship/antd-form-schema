import { Form } from 'antd';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SchemaForm } from '../src';
import type {
  FieldConverter,
  FormInstance,
  FormSchema,
  UseFormSchemaOptions,
  UseFormSchemaResult,
} from '../src/core/types';
import { useEffect } from 'react';
import { useFormSchema } from '../src/useFormSchema';

afterEach(cleanup);

function Harness({
  meta,
  capture,
  options,
}: {
  meta: FormSchema;
  capture: (value: { form: FormInstance; result: UseFormSchemaResult }) => void;
  options?: UseFormSchemaOptions;
}) {
  const [form] = Form.useForm();
  const result = useFormSchema(meta, form, options);
  useEffect(() => {
    capture({ form, result });
  });
  return (
    <Form form={form} initialValues={meta.initialValues} disabled={meta.disabled}>
      {result.visibleFields.map((field) => (
        <Form.Item key={field.key} {...field.itemProps}>
          {field.control}
        </Form.Item>
      ))}
    </Form>
  );
}

const ratio: FieldConverter = {
  read: (value) => (value == null ? value : Number(value) * 100),
  write: (value) => (value == null ? value : Number(value) / 100),
};

const money: FieldConverter = {
  read: (value) => (value == null ? value : Number(value) / 100),
  write: (value) => (value == null ? value : Math.round(Number(value) * 100)),
};

describe('field converters (render)', () => {
  it('shows the stored cents as yuan and writes yuan back as cents', () => {
    let form!: FormInstance;
    const meta: FormSchema = {
      initialValues: { amount: 1999 },
      fields: [{ key: 'amount', label: 'Amount', widget: 'number', converter: 'money' }],
    };
    render(<Harness meta={meta} options={{ converters: { money } }} capture={(value) => (form = value.form)} />);

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('19.99');

    fireEvent.change(input, { target: { value: '20.5' } });
    expect(form.getFieldValue('amount')).toBe(2050);
  });

  it('reports an unknown converter id as an error', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const meta: FormSchema = { fields: [{ key: 'amount', converter: 'missing' }] };
    expect(() => render(<SchemaForm meta={meta} converters={{ money }} />)).toThrow(
      /unregistered converter/,
    );
    warn.mockRestore();
  });

  it('reads the value through the converter in view mode', () => {
    const meta: FormSchema = {
      initialValues: { amount: 1999 },
      viewMode: true,
      fields: [{ key: 'amount', label: 'Amount', converter: 'money' }],
    };
    render(<SchemaForm meta={meta} converters={{ money }} />);
    expect(screen.getByText('19.99')).toBeInTheDocument();
  });

  it('does nothing when no converter is configured', () => {
    let form!: FormInstance;
    const meta: FormSchema = {
      initialValues: { amount: 1999 },
      fields: [{ key: 'amount', label: 'Amount', widget: 'number' }],
    };
    render(<Harness meta={meta} capture={(value) => (form = value.form)} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('1999');
    act(() => {
      fireEvent.change(input, { target: { value: '2000' } });
    });
    expect(form.getFieldValue('amount')).toBe(2000);
  });

  it('applies a meta-level converter to every field keyed in meta.converters', () => {
    let form!: FormInstance;
    const meta: FormSchema = {
      initialValues: { amount: 1999 },
      converters: { amount: 'money' },
      fields: [{ key: 'amount', label: 'Amount', widget: 'number' }],
    };
    render(<Harness meta={meta} options={{ converters: { money } }} capture={(value) => (form = value.form)} />);

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('19.99');

    fireEvent.change(input, { target: { value: '20.5' } });
    expect(form.getFieldValue('amount')).toBe(2050);
  });

  it('lets the field converter override meta.converters', () => {
    const meta: FormSchema = {
      initialValues: { amount: 0.125 },
      converters: { amount: 'money' },
      fields: [{ key: 'amount', label: 'Amount', widget: 'number', converter: 'ratio' }],
    };
    render(<SchemaForm meta={meta} converters={{ money, ratio }} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('12.5');
  });

  it('reports an unknown id coming from meta.converters', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const meta: FormSchema = {
      converters: { amount: 'missing' },
      fields: [{ key: 'amount' }],
    };
    expect(() => render(<SchemaForm meta={meta} converters={{ money }} />)).toThrow(
      /unregistered converter/,
    );
    warn.mockRestore();
  });
});
