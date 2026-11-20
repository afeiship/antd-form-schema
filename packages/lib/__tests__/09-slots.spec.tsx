import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Form } from 'antd';
import { SchemaFields, SchemaForm } from '../src';
import type { BoundField } from '../src/types';

describe('SchemaFields slots', () => {
  it('does not emit a React key warning on the default field path', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <Form>
          <SchemaFields
            meta={{
              fields: [
                { key: 'a', label: 'A', widget: 'input' },
                { key: 'b', label: 'B', widget: 'input' },
              ],
            }}
          />
        </Form>,
      );
      const keyWarnings = consoleError.mock.calls.filter((args) =>
        /unique "key"|key prop/i.test(String(args[0] ?? '')),
      );
      expect(keyWarnings).toHaveLength(0);
      expect(document.querySelectorAll('input').length).toBe(2);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('uses a custom label slot without losing the default control', () => {
    const Label = ({ field }: { field: BoundField }) => <b data-testid="custom-label">{String(field.label)}?</b>;
    render(
      <Form>
        <SchemaFields meta={{ fields: [{ key: 'name', label: 'Name', widget: 'input' }] }} slots={{ label: Label }} />
      </Form>,
    );
    expect(screen.getByTestId('custom-label')).toHaveTextContent('Name?');
    expect(document.querySelector('input')).toBeInTheDocument();
  });

  it('accepts a ReactNode slot and renders it for every field', () => {
    render(
      <Form>
        <SchemaFields
          meta={{ fields: [{ key: 'a', label: 'A', widget: 'input' }, { key: 'b', label: 'B', widget: 'input' }] }}
          slots={{ label: <i>NODE</i> }}
        />
      </Form>,
    );
    expect(screen.getAllByText('NODE').length).toBe(2);
  });

  it('merges {component, props} config with runtime props (runtime wins)', () => {
    const Label = ({ field, suffix }: { field: BoundField; suffix: string }) => (
      <b data-testid="configured-label">{String(field?.label)}{suffix}</b>
    );
    render(
      <Form>
        <SchemaFields
          meta={{ fields: [{ key: 'a', label: 'A', widget: 'input' }] }}
          slots={{ label: { component: Label, props: { field: 'CONFIG', suffix: 'CONFIG' } } }}
        />
      </Form>,
    );
    // `suffix` comes from config; `field` is overridden by the runtime slot context.
    expect(screen.getByTestId('configured-label')).toHaveTextContent('ACONFIG');
  });

  it('renders controls for every field when a custom field slot is provided', () => {
    const Field = ({ children }: { children: ReactNode }) => <section data-testid="custom-field">{children}</section>;
    render(
      <Form>
        <SchemaFields
          meta={{
            fields: [
              { key: 'a', label: 'A', widget: 'input' },
              { key: 'b', label: 'B', widget: 'input' },
            ],
          }}
          slots={{ field: Field }}
        />
      </Form>,
    );
    expect(screen.getAllByTestId('custom-field')).toHaveLength(2);
    expect(document.querySelectorAll('input').length).toBe(2);
  });

  it('renders default validation error when no error slot is provided', async () => {
    render(
      <Form>
        <SchemaFields meta={{ fields: [{ key: 'name', label: 'Name', required: true, widget: 'input' }] }} />
        <button type="submit">Go</button>
      </Form>,
    );
    fireEvent.click(screen.getByText('Go'));
    expect(await screen.findByText(/required/i)).toBeInTheDocument();
  });

  it('delegates validation errors to antd Form.Item (error slot removed)', async () => {
    render(
      <Form>
        <SchemaFields meta={{ fields: [{ key: 'name', label: 'Name', required: true, widget: 'input' }] }} />
        <button type="submit">Go</button>
      </Form>,
    );
    fireEvent.click(screen.getByText('Go'));
    expect(await screen.findByText(/required/i)).toBeInTheDocument();
    expect(document.querySelector('.ant-form-item-explain-error')).toBeInTheDocument();
  });

  it('passes slots through SchemaForm', () => {
    const Label = () => <b data-testid="slot-label">SLOT</b>;
    render(<SchemaForm meta={{ fields: [{ key: 'name', label: 'Name', widget: 'input' }] }} slots={{ label: Label }} />);
    expect(screen.getByTestId('slot-label')).toBeInTheDocument();
  });
});
