import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import { Form } from 'antd';
import { SchemaFields, SchemaForm } from '../src';
import type { FormSchema } from '../src/core/types';

const metaWithName: FormSchema = { fields: [{ key: 'name', label: 'Name', required: true, widget: 'input' }] };

describe('SchemaFields', () => {
  it('applies classNames.field/label/control to the default renderers', () => {
    render(
      <Form>
        <SchemaFields
          meta={metaWithName}
          classNames={{ field: 'field-cls', label: 'label-cls', control: 'control-cls' }}
        />
      </Form>,
    );
    const item = document.querySelector('.field-cls') as HTMLElement;
    expect(item).toHaveClass('ant-form-item');
    expect(item.parentElement).toBe(document.querySelector('form'));
    expect(item.querySelector('.label-cls')).toHaveTextContent('Name');
    expect(item.querySelector('.ant-form-item-required')).toBeInTheDocument();
    expect(item.querySelector('input.control-cls')).toBeInTheDocument();
  });

  it('warns and ignores classNames.form because there is no Form element to attach it to', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(
        <Form>
          <SchemaFields meta={{ fields: [] }} classNames={{ form: 'grid-cls', field: 'field-cls' }} />
        </Form>,
      );
      expect(document.querySelector('.grid-cls')).toBeNull();
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/classNames\.form.*ineffective/i));
    } finally {
      warn.mockRestore();
    }
  });

  it('hides fields whose declarative condition is false', () => {
    const meta: FormSchema = {
      fields: [
        { key: 'role', widget: 'input' },
        { key: 'company', widget: 'input', condition: { field: 'role', op: 'eq', value: 'admin' } },
      ],
    };
    render(
      <Form initialValues={{ role: 'user' }}>
        <SchemaFields meta={meta} />
      </Form>,
    );
    expect(document.querySelectorAll('input').length).toBe(1);
  });

  it('throws a clear error when used outside a Form', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<SchemaFields meta={{ fields: [] }} />)).toThrow(/must be used inside/i);
    consoleError.mockRestore();
  });
});

describe('SchemaForm', () => {
  it('creates an internal form and applies meta.initialValues', () => {
    render(
      <SchemaForm
        meta={{ initialValues: { name: 'Alice' }, fields: [{ key: 'name', label: 'Name', widget: 'input' }] }}
      >
        <button type="submit">Submit</button>
      </SchemaForm>,
    );
    expect((document.querySelector('.ant-input') as HTMLInputElement).value).toBe('Alice');
  });

  it('shows validation errors (Form.Item is not noStyle)', async () => {
    render(<SchemaForm meta={metaWithName}><button type="submit">Submit</button></SchemaForm>);
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText(/required/i)).toBeInTheDocument();
  });

  it('calls onFormReady once with the internal form instance', () => {
    const onFormReady = vi.fn();
    const { rerender } = render(<SchemaForm meta={{ fields: [] }} onFormReady={onFormReady} />);
    rerender(<SchemaForm meta={{ fields: [] }} onFormReady={onFormReady} />);
    expect(onFormReady).toHaveBeenCalledTimes(1);
    expect(onFormReady.mock.calls[0][0]).toHaveProperty('getFieldsValue');
  });

  it('puts classNames.form on the internal Form and forwards the rest to SchemaFields', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { container } = render(
        <SchemaForm
          meta={metaWithName}
          classNames={{ form: 'grid-cls', field: 'field-cls', label: 'label-cls', control: 'control-cls' }}
        >
          <button type="submit">Go</button>
        </SchemaForm>,
      );
      const form = container.querySelector('form');
      expect(form).toHaveClass('grid-cls');
      expect(form?.querySelector('.field-cls')).toBeInTheDocument();
      expect(form?.querySelector('.label-cls')).toBeInTheDocument();
      expect(form?.querySelector('input.control-cls')).toBeInTheDocument();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('renders children after the fields', () => {
    render(
      <SchemaForm meta={metaWithName} classNames={{ form: 'grid-cls' }}>
        <button type="submit">Go</button>
      </SchemaForm>,
    );
    expect(document.querySelector('form')).toHaveTextContent('Go');
  });
});

describe('SchemaForm initialValues precedence', () => {
  it('ignores a caller-supplied initialValues prop in favor of meta.initialValues', () => {
    render(
      <SchemaForm
        meta={{ initialValues: { name: 'FromMeta' }, fields: [{ key: 'name', label: 'Name', widget: 'input' }] }}
        {...({ initialValues: { name: 'FromProp' } } as Record<string, unknown>)}
      />,
    );
    expect((document.querySelector('.ant-input') as HTMLInputElement).value).toBe('FromMeta');
  });
});

describe('SchemaForm normalizeValues', () => {
  it('applies meta.normalizeValues before onFinish', async () => {
    const onFinish = vi.fn();
    const meta: FormSchema = {
      fields: [{ key: 'name', label: 'Name', widget: 'input' }],
      normalizeValues: (values) => ({ ...values, extra: 1 }),
    };
    render(
      <SchemaForm meta={meta} onFinish={onFinish}>
        <button type="submit">Go</button>
      </SchemaForm>,
    );
    fireEvent.input(document.querySelector('.ant-input') as HTMLElement, { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    await screen.findByText(/go/i);
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ extra: 1, name: 'x' }));
  });

  it('onFinish receives raw values when normalizeValues is absent', async () => {
    const onFinish = vi.fn();
    render(
      <SchemaForm meta={metaWithName} onFinish={onFinish}>
        <button type="submit">Go</button>
      </SchemaForm>,
    );
    fireEvent.input(document.querySelector('.ant-input') as HTMLElement, { target: { value: 'y' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    await screen.findByText(/go/i);
    const values = onFinish.mock.calls[0][0];
    expect(values).toEqual({ name: 'y' });
  });
});
