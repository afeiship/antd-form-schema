import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import { Form } from 'antd';
import { SchemaFields } from '../src';
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
    expect(item?.querySelector('.label-cls')).toHaveTextContent('*');
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
