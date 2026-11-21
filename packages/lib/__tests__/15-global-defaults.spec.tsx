import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Form } from 'antd';
import {
  configureSchemaForm,
  getSchemaFormDefaults,
  resetSchemaFormDefaults,
  SchemaForm,
  useFormSchema,
} from '../src';
import type { FieldConverter, FormSchema, Presets } from '../src';

const presets: Presets = {
  fields: { title: 'input', price: 'number' },
  labels: {
    'zh-CN': { title: '标题', price: '价格' },
    'en-US': { title: 'Title', price: 'Price' },
  },
};

/** storage cents -> control yuan */
const money: FieldConverter = {
  read: (value) => (value == null ? value : Number(value) / 100),
  write: (value) => (value == null ? value : Math.round(Number(value) * 100)),
};

const meta: FormSchema = {
  initialValues: { price: 1999 },
  fields: [
    { key: 'title' },
    { key: 'price', converter: 'money' },
  ],
};

describe('global schema defaults', () => {
  beforeEach(() => resetSchemaFormDefaults());
  afterEach(() => resetSchemaFormDefaults());

  it('SchemaForm uses global presets, converters and locale without props', () => {
    configureSchemaForm({ presets, converters: { money }, locale: 'zh-CN' });

    render(<SchemaForm meta={meta} />);

    expect(screen.getByText('标题')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).toHaveValue('19.99');
  });

  it('form-level locale overrides the global locale', () => {
    configureSchemaForm({ presets, locale: 'zh-CN' });

    render(<SchemaForm meta={{ fields: [{ key: 'title' }] }} locale="en-US" />);

    expect(screen.getByText('Title')).toBeInTheDocument();
  });

  it('merges form-level presets per key and keeps the remaining global entries', () => {
    configureSchemaForm({
      locale: 'zh-CN',
      presets: {
        labels: {
          'zh-CN': { title: '全局标题', status: '状态' },
        },
      },
    });

    render(
      <SchemaForm
        meta={{ fields: [{ key: 'title' }, { key: 'status' }] }}
        presets={{ labels: { 'zh-CN': { title: '本地标题' } } }}
      />,
    );

    expect(screen.getByText('本地标题')).toBeInTheDocument();
    expect(screen.getByText('状态')).toBeInTheDocument();
  });

  it('merges form-level converters per id: local wins, global ids stay available', () => {
    configureSchemaForm({
      converters: {
        money,
        ratio: {
          read: (value) => (value == null ? value : Number(value) * 100),
        },
      },
    });

    render(
      <SchemaForm
        meta={{
          initialValues: { price: 1999, discount: 0.5 },
          fields: [
            { key: 'price', widget: 'number', converter: 'money' },
            { key: 'discount', widget: 'number', converter: 'ratio' },
          ],
        }}
        converters={{
          money: {
            read: (value) => (value == null ? value : Number(value) / 10),
          },
        }}
      />,
    );

    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs[0]).toHaveValue('199.9');
    expect(inputs[1]).toHaveValue('50');
  });

  it('useFormSchema receives the same defaults', () => {
    configureSchemaForm({ presets, locale: 'zh-CN' });

    function Headless() {
      const [form] = Form.useForm();
      const { visibleFields } = useFormSchema({ fields: [{ key: 'title' }] }, form);
      return (
        <Form form={form}>
          {visibleFields.map((field) => (
            <Form.Item key={field.key} label={field.label}>
              {field.control}
            </Form.Item>
          ))}
        </Form>
      );
    }

    render(<Headless />);

    expect(screen.getByText('标题')).toBeInTheDocument();
  });

  it('configureSchemaForm merges by field and reset clears everything', () => {
    configureSchemaForm({ presets, locale: 'zh-CN' });
    configureSchemaForm({ converters: { money } });

    const snapshot = getSchemaFormDefaults();
    expect(snapshot.presets).toBe(presets);
    expect(snapshot.locale).toBe('zh-CN');
    expect(snapshot.converters).toEqual({ money });

    snapshot.locale = 'en-US';
    expect(getSchemaFormDefaults().locale).toBe('zh-CN');

    resetSchemaFormDefaults();
    expect(getSchemaFormDefaults()).toEqual({});
  });
});
