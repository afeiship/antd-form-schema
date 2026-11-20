import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it } from 'vitest';
import { Form } from 'antd';
import AntdFormSchema, { FormFields } from '../src';
import type { BoundField } from '../src/types';

function makeField(overrides: Partial<BoundField> = {}): BoundField {
  return {
    key: 'name',
    name: 'name',
    widget: 'input',
    label: 'Name',
    required: true,
    visible: true,
    viewMode: false,
    itemProps: { name: 'name' },
    control: <input id="name" />,
    controlProps: {},
    ...overrides,
  };
}

describe('FormFields', () => {
  it('exposes the same component as the default export', () => {
    expect(AntdFormSchema).toBe(FormFields);
  });

  it('renders the label and control of a visible field, with required mark from antd', () => {
    render(
      <Form>
        <FormFields fields={[makeField({ control: <input /> })]} />
      </Form>,
    );
    expect(screen.getByText('Name')).toBeInTheDocument();
    // antd renders the required mark via its label CSS class, not a literal `*`.
    expect(document.querySelector('.ant-form-item-required')).toBeInTheDocument();
    expect(document.querySelector('input')).toBeInTheDocument();
  });

  it('merges className and keeps the scaffold data-component marker', () => {
    const { container } = render(<FormFields fields={[]} className="custom-class" />);
    expect(container.firstChild).toHaveClass('antd-form-schema', 'custom-class');
    expect(container.firstChild).toHaveAttribute('data-component', 'antd-form-schema');
  });

  it('skips fields whose visible flag is false', () => {
    const { container } = render(
      <FormFields fields={[makeField({ key: 'secret', label: 'Secret', visible: false })]} />,
    );
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
    expect(container.querySelector('#name')).toBeNull();
  });

  it('associates the label with the control so clicking it focuses the input', () => {
    render(
      <Form>
        <FormFields fields={[makeField({ control: <input /> })]} />
      </Form>,
    );
    const input = document.querySelector('input') as HTMLInputElement;
    const label = screen.getByText('Name') as HTMLLabelElement;
    expect(label.htmlFor).toBe(input.id);
    expect(input.id).not.toBe('');
    expect(document.getElementById(label.htmlFor)).toBe(input);
  });
});
