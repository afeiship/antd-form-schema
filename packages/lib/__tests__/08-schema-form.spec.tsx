import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import { Form } from 'antd';
import { SchemaFields, SchemaForm } from '../src';
import type { FormSchema } from '../src/types';

describe('SchemaFields', () => {
  it('renders fields from meta with all className hooks inside a Form', () => {
    render(
      <Form>
        <SchemaFields
          meta={{ fields: [{ key: 'name', label: 'Name', required: true, widget: 'input' }] }}
          className="grid-cls"
          itemClassName="item-cls"
          labelClassName="label-cls"
          controlClassName="control-cls"
        />
      </Form>,
    );
    const grid = document.querySelector('.grid-cls');
    expect(grid).toBeInTheDocument();
    const item = grid?.querySelector('.item-cls');
    expect(item).toBeInTheDocument();
    expect(item?.querySelector('.label-cls')).toHaveTextContent('Name');
    // antd renders the required mark via CSS class, not a literal `*`.
    expect(item?.querySelector('.ant-form-item-required')).toBeInTheDocument();
    expect(item?.querySelector('.control-cls input')).toBeInTheDocument();
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
        meta={{
          initialValues: { name: 'Alice' },
          fields: [{ key: 'name', label: 'Name', widget: 'input' }],
        }}
      >
        <button type="submit">Submit</button>
      </SchemaForm>,
    );
    expect((document.querySelector('.ant-input') as HTMLInputElement).value).toBe('Alice');
  });

  it('shows validation errors (Form.Item is not noStyle)', async () => {
    render(
      <SchemaForm meta={{ fields: [{ key: 'name', label: 'Name', required: true, widget: 'input' }] }}>
        <button type="submit">Submit</button>
      </SchemaForm>,
    );
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

  it('renders children after the field grid', () => {
    render(
      <SchemaForm meta={{ fields: [{ key: 'name', label: 'Name', widget: 'input' }] }} className="grid-cls">
        <button type="submit">Go</button>
      </SchemaForm>,
    );
    expect(document.querySelector('.grid-cls')?.nextElementSibling).toHaveTextContent('Go');
  });
});

describe('SchemaForm initialValues precedence', () => {
  it('ignores a caller-supplied initialValues prop in favor of meta.initialValues', () => {
    render(
      <SchemaForm
        meta={{
          initialValues: { name: 'FromMeta' },
          fields: [{ key: 'name', label: 'Name', widget: 'input' }],
        }}
        {...({ initialValues: { name: 'FromProp' } } as Record<string, unknown>)}
      />,
    );
    expect((document.querySelector('.ant-input') as HTMLInputElement).value).toBe('FromMeta');
  });
});
