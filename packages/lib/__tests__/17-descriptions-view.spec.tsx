import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SchemaForm } from '../src';
import type { FieldConverter, FormSchema } from '../src/core/types';

afterEach(() => {
  vi.restoreAllMocks();
});

const money: FieldConverter = {
  read: (value) => (value == null ? value : Number(value) / 100),
  write: (value) => (value == null ? value : Math.round(Number(value) * 100)),
};

describe('SchemaForm: Descriptions view mode', () => {
  it('renders a bordered descriptions grid with labels and option labels', () => {
    const meta: FormSchema = {
      viewMode: true,
      view: { title: '用户详情', column: 2, bordered: true, size: 'small' },
      initialValues: { name: 'Alice', role: 'admin' },
      fields: [
        { key: 'name', label: '姓名' },
        {
          key: 'role',
          label: '角色',
          widget: 'select',
          options: [['admin', '管理员']],
        },
      ],
    };

    const { container } = render(<SchemaForm meta={meta} />);

    expect(container.querySelector('.ant-descriptions')).toBeTruthy();
    expect(container.querySelector('.ant-descriptions-bordered')).toBeTruthy();
    expect(container.querySelector('.ant-descriptions-small')).toBeTruthy();
    expect(screen.getByText('用户详情')).toBeInTheDocument();
    expect(screen.getByText('姓名')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('管理员')).toBeInTheDocument();
    expect(container.querySelectorAll('.ant-form-item:not(.ant-form-item-hidden)')).toHaveLength(
      0,
    );
  });

  it('honors field-level viewSpan in the descriptions table', () => {
    const meta: FormSchema = {
      viewMode: true,
      initialValues: { name: 'Alice', nickname: 'ali', bio: 'hello' },
      fields: [
        { key: 'name', label: '姓名' },
        { key: 'nickname', label: '昵称' },
        { key: 'bio', label: '个人简介', viewSpan: 2 },
      ],
    };

    const { container } = render(<SchemaForm meta={meta} />);

    expect(container.querySelector('td[colspan="3"]')).toBeTruthy();
    expect(screen.getByText('个人简介')).toBeInTheDocument();
  });

  it('passes viewProps to a custom viewWidget', () => {
    const StatusView = ({ initialValue, options, color }: any) => {
      const label =
        options?.find((option: any) => option.value === initialValue)?.label ?? initialValue;
      return (
        <span data-testid="status-view" data-color={color}>
          {label}
        </span>
      );
    };
    const meta: FormSchema = {
      viewMode: true,
      initialValues: { status: 'active' },
      fields: [
        {
          key: 'status',
          label: '状态',
          options: [
            ['active', '活跃'],
            ['disabled', '禁用'],
          ],
          viewWidget: StatusView,
          viewProps: { color: 'green' },
        },
      ],
    };

    render(<SchemaForm meta={meta} />);

    expect(screen.getByTestId('status-view')).toHaveTextContent('活跃');
    expect(screen.getByTestId('status-view')).toHaveAttribute('data-color', 'green');
  });

  it('keeps hidden field values while removing them from descriptions', async () => {
    let submitted: any;
    const meta: FormSchema = {
      viewMode: true,
      initialValues: { name: 'Alice', company: 'ACME' },
      fields: [
        { key: 'name', label: '姓名', required: true },
        { key: 'company', hidden: true },
      ],
    };

    const { container } = render(
      <SchemaForm meta={meta} onFinish={(values) => (submitted = values)}>
        <button type="submit">go</button>
      </SchemaForm>,
    );

    expect(container.querySelector('.ant-descriptions')).not.toHaveTextContent('ACME');
    expect(container.querySelector('.ant-form-item-hidden')).toHaveTextContent('ACME');

    fireEvent.click(container.querySelector('button[type=submit]') as HTMLElement);
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(submitted).toEqual({ name: 'Alice', company: 'ACME' });
  });

  it('does not render fields hidden by a condition', () => {
    const meta: FormSchema = {
      viewMode: true,
      initialValues: { role: 'user', company: 'ACME' },
      fields: [
        {
          key: 'role',
          label: '角色',
          widget: 'select',
          options: [
            ['admin', '管理员'],
            ['user', '普通用户'],
          ],
        },
        {
          key: 'company',
          label: '公司',
          condition: { field: 'role', op: 'eq', value: 'admin' },
        },
      ],
    };

    render(<SchemaForm meta={meta} />);

    expect(screen.queryByText('公司')).not.toBeInTheDocument();
    expect(screen.getByText('普通用户')).toBeInTheDocument();
  });

  it('applies converter read in view mode', () => {
    const meta: FormSchema = {
      viewMode: true,
      initialValues: { amount: 1999 },
      fields: [{ key: 'amount', label: '金额', converter: 'money' }],
    };

    render(<SchemaForm meta={meta} converters={{ money }} />);

    expect(screen.getByText('19.99')).toBeInTheDocument();
  });

  it('rejects an unregistered viewWidget in development', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const meta: FormSchema = {
      viewMode: true,
      fields: [{ key: 'name', viewWidget: 'missing' }],
    };

    expect(() => render(<SchemaForm meta={meta} />)).toThrow(/unregistered viewWidget/);
    warn.mockRestore();
  });

  it('warns when viewSpan is not a positive integer', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const meta: FormSchema = {
      viewMode: true,
      fields: [{ key: 'name', label: '姓名', viewSpan: 0 }],
    };

    render(<SchemaForm meta={meta} />);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('viewSpan must be a positive integer'));
  });
});
