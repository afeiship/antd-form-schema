import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it } from 'vitest';
import { Form } from 'antd';
import { SchemaForm } from '../src';
import { useFormSchema } from '../src/useFormSchema';

const baseMeta = {
  initialValues: { role: 'user', company: 'ACME' },
  fields: [
    { key: 'role', label: 'Role', widget: 'select', options: ['user', 'admin'] },
    { key: 'company', label: 'Company', widget: 'input', hidden: true },
  ],
} as any;

describe('hidden fields', () => {
  it('renders no visible row but submits the value', async () => {
    let submitted: any = 'not-called';
    const { container } = render(
      <SchemaForm meta={baseMeta} onFinish={(v: any) => (submitted = v)}>
        <button type="submit">go</button>
      </SchemaForm>,
    );
    const companyItem = [...container.querySelectorAll('.ant-form-item')].find((el) =>
      el.querySelector('#company'),
    );
    expect(companyItem).toBeTruthy();
    expect(companyItem!.className).toContain('ant-form-item-hidden');
    fireEvent.click(container.querySelector('button[type=submit]') as HTMLElement);
    await new Promise((r) => setTimeout(r, 300));
    expect(submitted).toMatchObject({ role: 'user', company: 'ACME' });
  });

  it('hidden field without initialValue adds no phantom key', async () => {
    const meta = {
      fields: [
        { key: 'name', label: 'Name', widget: 'input' },
        { key: 'company', label: 'Company', widget: 'input', hidden: true },
      ],
    } as any;
    let submitted: any = 'not-called';
    const { container } = render(
      <SchemaForm meta={meta} onFinish={(v: any) => (submitted = v)}>
        <button type="submit">go</button>
      </SchemaForm>,
    );
    fireEvent.click(container.querySelector('button[type=submit]') as HTMLElement);
    await new Promise((r) => setTimeout(r, 300));
    expect(submitted).toEqual({ name: undefined });
  });

  it('hidden wins over condition', async () => {
    const meta = {
      initialValues: { role: 'admin' },
      fields: [
        { key: 'role', label: 'Role', widget: 'select', options: [{ value: 'admin', label: 'A' }] },
        { key: 'company', label: 'Company', widget: 'input', hidden: true, condition: { field: 'role', op: 'eq', value: 'admin' } },
      ],
    } as any;
    let submitted: any = 'not-called';
    const { container } = render(
      <SchemaForm meta={meta} onFinish={(v: any) => (submitted = v)}>
        <button type="submit">go</button>
      </SchemaForm>,
    );
    expect(container.querySelector('.ant-form-item-hidden')).toBeTruthy();
    expect(
      [...container.querySelectorAll('.ant-form-item')].filter((el) => !el.className.includes('ant-form-item-hidden'))
        .length,
    ).toBe(1); // only role
    fireEvent.click(container.querySelector('button[type=submit]') as HTMLElement);
    await new Promise((r) => setTimeout(r, 300));
    expect(submitted).toMatchObject({ role: 'admin', company: undefined });
  });

  it('headless: hidden excluded from visibleFields, present in getField and renderableFields', () => {
    let captured: any;
    function Harness() {
      const [form] = Form.useForm();
      const result = useFormSchema(baseMeta, form);
      captured = result;
      return null;
    }
    render(
      <Form>
        <Harness />
      </Form>,
    );
    expect(captured.visibleFields.map((f: any) => f.key)).toEqual(['role']);
    expect(captured.renderableFields.map((f: any) => f.key)).toEqual(['role', 'company']);
    expect(captured.getField('company')?.hidden).toBe(true);
  });

  it('view mode + hidden does not crash, value survives', async () => {
    const meta = { viewMode: true, ...baseMeta } as any;
    let submitted: any = 'not-called';
    const { container } = render(
      <SchemaForm meta={meta} onFinish={(v: any) => (submitted = v)}>
        <button type="submit">go</button>
      </SchemaForm>,
    );
    expect(container.querySelector('.ant-form-item-hidden')).toBeTruthy();
    fireEvent.click(container.querySelector('button[type=submit]') as HTMLElement);
    await new Promise((r) => setTimeout(r, 300));
    expect(submitted).toMatchObject({ company: 'ACME' });
  });
});
