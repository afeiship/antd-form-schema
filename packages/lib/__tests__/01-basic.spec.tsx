import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it } from 'vitest';
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

  it('renders the label, required mark and control of a visible field', () => {
    render(<FormFields fields={[makeField()]} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('*')).toBeInTheDocument();
    expect(document.getElementById('name')).toBeInTheDocument();
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
});
