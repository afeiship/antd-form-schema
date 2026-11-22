import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Form } from 'antd';
import {
  configureSchemaForm,
  resetSchemaFormDefaults,
  SchemaForm,
  useFormSchema,
} from '../src';
import type { FormSchema } from '../src/core/types';

/** Capture the latest props a custom component receives, for assertions. */
let captured: Record<string, any>;

const CitySelector = (props: Record<string, any>) => {
  captured = props;
  return (
    <button type="button" onClick={() => props.onChange?.('wuhan')}>
      {props.value ?? 'empty'}
    </button>
  );
};

const OtherCity = () => <span data-testid="other-city">other</span>;

const TagInput = (props: Record<string, any>) => {
  captured = props;
  return <span data-testid="tag-input">{(props.value ?? []).join(',')}</span>;
};

/** checked-style control: bound through valuePropName 'checked'. */
const FlagSwitch = (props: Record<string, any>) => {
  captured = props;
  return (
    <button type="button" onClick={() => props.onChange?.(!props.checked)}>
      {props.checked ? 'on' : 'off'}
    </button>
  );
};

const StatusTag = (props: Record<string, any>) => (
  <span data-testid="status-tag">{props.initialValue ?? props.value}</span>
);

describe('global widget registry', () => {
  beforeEach(() => resetSchemaFormDefaults());
  afterEach(() => resetSchemaFormDefaults());

  it('renders a globally registered bare component referenced by string id and binds value', () => {
    configureSchemaForm({ widgets: { 'city-selector': CitySelector } });

    const meta: FormSchema = {
      fields: [{ key: 'city', label: '城市', widget: 'city-selector', placeholder: '请选择城市' }],
    };
    render(
      <SchemaForm meta={meta}>
        <button type="submit">go</button>
      </SchemaForm>,
    );

    expect(captured.placeholder).toBe('请选择城市');
    fireEvent.click(screen.getByText('empty'));
    expect(captured.value).toBe('wuhan');
  });

  it('applies metaConverter from a global definition object (valuePropName checked)', () => {
    configureSchemaForm({
      widgets: {
        'flag-switch': {
          component: FlagSwitch,
          metaConverter: () => ({ valuePropName: 'checked' }),
        },
      },
    });

    const meta: FormSchema = {
      initialValues: { flag: true },
      fields: [{ key: 'flag', label: 'Flag', widget: 'flag-switch' }],
    };
    render(
      <SchemaForm meta={meta}>
        <button type="submit">go</button>
      </SchemaForm>,
    );

    expect(captured.checked).toBe(true);
    expect(captured.value).toBeUndefined();
    fireEvent.click(screen.getByText('on'));
    expect(captured.checked).toBe(false);
  });

  it('merges widgetProps from the field onto the registered component', () => {
    configureSchemaForm({ widgets: { 'tag-input': TagInput } });

    const meta: FormSchema = {
      initialValues: { tags: ['a', 'b'] },
      fields: [{ key: 'tags', widget: 'tag-input', widgetProps: { max: 8 } }],
    };
    render(
      <SchemaForm meta={meta}>
        <button type="submit">go</button>
      </SchemaForm>,
    );

    expect(captured.max).toBe(8);
    expect(screen.getByTestId('tag-input')).toHaveTextContent('a,b');
  });

  it('form-level widgets override the global entry by id; other global ids stay available', () => {
    configureSchemaForm({
      widgets: { 'city-selector': CitySelector, 'tag-input': TagInput },
    });

    const meta: FormSchema = {
      fields: [
        { key: 'city', widget: 'city-selector' },
        { key: 'tags', widget: 'tag-input' },
      ],
    };
    render(
      <SchemaForm meta={meta} widgets={{ 'city-selector': OtherCity }}>
        <button type="submit">go</button>
      </SchemaForm>,
    );

    expect(screen.getByTestId('other-city')).toBeInTheDocument();
    expect(screen.getByTestId('tag-input')).toBeInTheDocument();
  });

  it('resolves a global widget for viewWidget in view mode', () => {
    configureSchemaForm({ widgets: { 'status-tag': StatusTag } });

    const meta: FormSchema = {
      viewMode: true,
      initialValues: { status: 'ok' },
      fields: [{ key: 'status', viewWidget: 'status-tag' }],
    };
    render(<SchemaForm meta={meta} />);

    expect(screen.getByTestId('status-tag')).toHaveTextContent('ok');
  });

  it('accepts bare-component shorthand and definition objects in the same registry', () => {
    configureSchemaForm({
      widgets: {
        'city-selector': CitySelector,
        'flag-switch': {
          component: FlagSwitch,
          metaConverter: () => ({ valuePropName: 'checked' }),
        },
      },
    });

    const meta: FormSchema = {
      fields: [
        { key: 'city', widget: 'city-selector' },
        { key: 'flag', widget: 'flag-switch' },
      ],
    };
    render(
      <SchemaForm meta={meta}>
        <button type="submit">go</button>
      </SchemaForm>,
    );

    expect(screen.getByText('empty')).toBeInTheDocument();
    expect(screen.getByText('off')).toBeInTheDocument();
  });

  it('throws for an unregistered string widget id in development', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const meta: FormSchema = { fields: [{ key: 'ghost', widget: 'ghost-widget' }] };
      expect(() => render(<SchemaForm meta={meta} />)).toThrow(/unregistered widget "ghost-widget"/);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('bypasses string-id validation when the widget is a direct component', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const meta: FormSchema = { fields: [{ key: 'city', widget: CitySelector }] };
      expect(() => render(<SchemaForm meta={meta} />)).not.toThrow();
      expect(screen.getByText('empty')).toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('useFormSchema receives the same global registry', () => {
    configureSchemaForm({ widgets: { 'tag-input': TagInput } });

    let capturedFields: any;
    function Harness() {
      const [form] = Form.useForm();
      capturedFields = useFormSchema(
        { fields: [{ key: 'tags', widget: 'tag-input' }] },
        form,
      );
      return null;
    }
    render(
      <Form>
        <Harness />
      </Form>,
    );

    expect(capturedFields.fields[0].WidgetComponent).toBe(TagInput);
  });

  it('resetSchemaFormDefaults clears the global registry', () => {
    configureSchemaForm({ widgets: { 'city-selector': CitySelector } });
    resetSchemaFormDefaults();

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const meta: FormSchema = { fields: [{ key: 'city', widget: 'city-selector' }] };
      expect(() => render(<SchemaForm meta={meta} />)).toThrow(/unregistered widget "city-selector"/);
    } finally {
      consoleError.mockRestore();
    }
  });
});
