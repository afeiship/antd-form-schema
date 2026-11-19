import { Form } from 'antd';
import { act, fireEvent, render, renderHook } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useFormSchema } from '../src/useFormSchema';
import type {
  FormInstance,
  FormSchema,
  UseFormSchemaOptions,
  UseFormSchemaResult,
} from '../src/types';

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
    <Form form={form} initialValues={meta.initialValues} disabled={meta.disabled}>
      {result.visibleFields.map((field) => (
        <Form.Item key={field.key} {...field.itemProps}>
          {field.control}
        </Form.Item>
      ))}
    </Form>
  );
}

describe('useFormSchema: conditional visibility', () => {
  it('hides a field by default and reveals it when a watched value changes (no onValuesChange)', () => {
    const meta: FormSchema = {
      initialValues: { role: 'user' },
      fields: [
        { key: 'role' },
        { key: 'company', condition: { field: 'role', op: 'eq', value: 'admin' } },
      ],
    };
    let captured!: Captured;
    render(<Harness meta={meta} capture={(value) => { captured = value; }} />);

    expect(captured.result.getField('company')?.visible).toBe(false);
    expect(captured.result.visibleFields.map((field) => field.key)).not.toContain('company');

    act(() => {
      captured.form.setFieldsValue({ role: 'admin' });
    });

    expect(captured.result.getField('company')?.visible).toBe(true);
    expect(captured.result.visibleFields.map((field) => field.key)).toContain('company');
  });

  it('getField returns the matching BoundField or undefined for an unknown key', () => {
    const meta: FormSchema = { fields: [{ key: 'name', label: 'Name' }] };
    let captured!: Captured;
    render(<Harness meta={meta} capture={(value) => { captured = value; }} />);

    expect(captured.result.getField('name')?.key).toBe('name');
    expect(captured.result.getField('missing')).toBeUndefined();
  });

  it('itemProps contains data-binding keys only', () => {
    const meta: FormSchema = {
      fields: [{ key: 'name', label: 'Name', placeholder: 'your name', required: true }],
    };
    let captured!: Captured;
    render(<Harness meta={meta} capture={(value) => { captured = value; }} />);

    const itemProps = captured.result.getField('name')!.itemProps as Record<string, unknown>;
    expect(Object.keys(itemProps).every((key) =>
      ['name', 'rules', 'valuePropName', 'dependencies', 'shouldUpdate'].includes(key),
    )).toBe(true);
    expect(itemProps).not.toHaveProperty('label');
    expect(itemProps).not.toHaveProperty('className');
    expect(itemProps).not.toHaveProperty('style');
  });

  it('uses a single-segment name for !!!-literal keys and reads the value from the form', () => {
    const meta: FormSchema = { fields: [{ key: '!!!a.b' }] };
    let captured!: Captured;
    render(<Harness meta={meta} capture={(value) => { captured = value; }} />);

    expect(captured.result.getField('!!!a.b')?.itemProps.name).toEqual(['a.b']);
    act(() => {
      captured.form.setFieldsValue({ 'a.b': 42 });
    });
    expect(captured.form.getFieldValue(['a.b'])).toBe(42);
  });

  it('keeps a hidden field value after it is unmounted from the DOM', () => {
    const meta: FormSchema = {
      initialValues: { role: 'admin' },
      fields: [
        { key: 'role' },
        { key: 'company', condition: { field: 'role', op: 'eq', value: 'admin' } },
      ],
    };
    let captured!: Captured;
    const { container } = render(
      <Harness meta={meta} capture={(value) => { captured = value; }} />,
    );

    act(() => {
      captured.form.setFieldsValue({ company: 'Acme' });
    });
    expect(container.querySelector('#company')).not.toBeNull();

    act(() => {
      captured.form.setFieldsValue({ role: 'user' });
    });
    expect(container.querySelector('#company')).toBeNull();
    expect(captured.form.getFieldValue('company')).toBe('Acme');
  });

  it('re-evaluates a function condition declared with watch paths', () => {
    const meta: FormSchema = {
      initialValues: { role: 'user' },
      fields: [
        { key: 'role' },
        { key: 'info', watch: ['role'], condition: ({ values }) => values.role === 'admin' },
      ],
    };
    let captured!: Captured;
    render(<Harness meta={meta} capture={(value) => { captured = value; }} />);

    expect(captured.result.getField('info')?.visible).toBe(false);
    act(() => {
      captured.form.setFieldsValue({ role: 'admin' });
    });
    expect(captured.result.getField('info')?.visible).toBe(true);
  });
});

describe('useFormSchema: BoundField passthrough', () => {
  it('surfaces field.initialValue on BoundField but not in itemProps', () => {
    const meta: FormSchema = {
      fields: [{ key: 'rating', initialValue: 3, required: true }],
    };
    let captured!: Captured;
    render(<Harness meta={meta} capture={(value) => { captured = value; }} />);

    const field = captured.result.getField('rating')!;
    expect(field.initialValue).toBe(3);
    expect(field.itemProps).not.toHaveProperty('initialValue');
    expect(captured.form.getFieldValue('rating')).toBeUndefined();
  });
});

describe('useFormSchema: dev validation', () => {
  it('exposes issues and warns in development', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const meta: FormSchema = {
      fields: [{ key: 'x', condition: { field: 'ghost', op: 'eq', value: 1 } }],
    };
    let captured!: Captured;
    render(<Harness meta={meta} capture={(value) => { captured = value; }} />);
    expect(captured.result.issues).toEqual([
      { level: 'warning', message: 'condition field "ghost" does not exist', field: 'ghost' },
    ]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('validates once per schema identity, not on every form-value rerender', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const meta: FormSchema = {
      fields: [
        { key: 'name' },
        { key: 'ghost-check', condition: { field: 'ghost', op: 'eq', value: 1 } },
      ],
    };
    let captured!: Captured;
    const { container } = render(<Harness meta={meta} capture={(value) => { captured = value; }} />);

    expect(warn).toHaveBeenCalledTimes(1);
    const issuesRef = captured.result.issues;

    const input = container.querySelector('#name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'typed' } });

    expect(captured.result.issues).toBe(issuesRef);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('skips validation and does not throw for unregistered widgets in production', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    try {
      const { useFormSchema: prodHook } = await import('../src/useFormSchema');
      renderHook(() => {
        const [form] = Form.useForm();
        const result = prodHook(
          {
            fields: [
              { key: 'x', widget: 'mystery' },
              { key: 'ghost-check', condition: { field: 'ghost', op: 'eq', value: 1 } },
            ],
          },
          form,
        );
        expect(result.issues).toEqual([]);
      });
      expect(warn).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
      warn.mockRestore();
    }
  });

  it('throws in development for an unregistered widget', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const swallow = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener('error', swallow);
    expect(() =>
      renderHook(() => {
        const [form] = Form.useForm();
        return useFormSchema(
          { fields: [{ key: 'x', widget: 'mystery' }] },
          form,
        );
      }),
    ).toThrow(/unregistered widget "mystery"/);
    window.removeEventListener('error', swallow);
    error.mockRestore();
    warn.mockRestore();
  });
});
