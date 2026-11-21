import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureSchemaForm, resetSchemaFormDefaults, SchemaForm } from '../src';
import type { FormSchema, Presets } from '../src';

afterEach(() => resetSchemaFormDefaults());

const labels = { 'zh-CN': { title: '标题', bio: '简介', status: '状态' } };

describe('preset field objects', () => {
  it('keeps the string shorthand working', () => {
    const presets: Presets = { fields: { title: 'input' }, labels };
    render(<SchemaForm meta={{ fields: [{ key: 'title' }] }} presets={presets} />);

    expect(screen.getByText('标题')).toBeInTheDocument();
    expect(document.querySelector('input.ant-input')).toBeInTheDocument();
  });

  it('forwards placeholder from the preset object', () => {
    const presets: Presets = {
      fields: { title: { widget: 'input', placeholder: '请输入标题' } },
      labels,
    };
    render(<SchemaForm meta={{ fields: [{ key: 'title' }] }} presets={presets} />);

    expect(screen.getByPlaceholderText('请输入标题')).toBeInTheDocument();
  });

  it('forwards numeric and boolean props to the control', () => {
    const presets: Presets = {
      fields: {
        title: {
          widget: 'input',
          maxLength: 12,
          disabled: true,
        },
      },
      labels,
    };
    render(<SchemaForm meta={{ fields: [{ key: 'title' }] }} presets={presets} />);

    const input = document.querySelector('input.ant-input') as HTMLInputElement;
    expect(input).toHaveAttribute('maxlength', '12');
    expect(input).toBeDisabled();
  });

  it('forwards object props such as textarea autoSize', () => {
    function Capture(props: Record<string, any>) {
      return <div data-testid="capture" data-autosize={JSON.stringify(props.autoSize)} />;
    }

    const presets: Presets = {
      fields: { bio: { widget: Capture, autoSize: { minRows: 2, maxRows: 4 } } },
      labels,
    };
    render(<SchemaForm meta={{ fields: [{ key: 'bio' }] }} presets={presets} />);

    expect(screen.getByTestId('capture')).toHaveAttribute(
      'data-autosize',
      JSON.stringify({ minRows: 2, maxRows: 4 }),
    );
  });

  it('lets explicit widgetProps win over shorthand props', () => {
    const presets: Presets = {
      fields: {
        title: {
          widget: 'input',
          placeholder: '直接属性',
          widgetProps: { placeholder: 'widgetProps' },
        },
      },
      labels,
    };
    render(<SchemaForm meta={{ fields: [{ key: 'title' }] }} presets={presets} />);

    expect(screen.getByPlaceholderText('widgetProps')).toBeInTheDocument();
  });
});

describe('preset props precedence against schema', () => {
  it('lets schema placeholder override the preset placeholder', () => {
    const presets: Presets = {
      fields: { title: { widget: 'input', placeholder: '预设占位' } },
      labels,
    };
    const meta: FormSchema = { fields: [{ key: 'title', placeholder: '字段占位' }] };
    render(<SchemaForm meta={meta} presets={presets} />);

    expect(screen.getByPlaceholderText('字段占位')).toBeInTheDocument();
  });

  it('lets schema widgetProps override the same preset prop', () => {
    const presets: Presets = {
      fields: { title: { widget: 'input', maxLength: 10 } },
      labels,
    };
    const meta: FormSchema = {
      fields: [{ key: 'title', widgetProps: { maxLength: 5 } }],
    };
    render(<SchemaForm meta={meta} presets={presets} />);

    expect(document.querySelector('input.ant-input')).toHaveAttribute('maxlength', '5');
  });

  it('keeps preset props when the schema only overrides the widget', () => {
    const presets: Presets = {
      fields: { title: { widget: 'input', placeholder: '预设占位' } },
      labels,
    };
    const meta: FormSchema = { fields: [{ key: 'title', widget: 'textarea' }] };
    render(<SchemaForm meta={meta} presets={presets} />);

    expect(document.querySelector('textarea')).toHaveAttribute('placeholder', '预设占位');
  });

  it('lets schema options, disabled and readOnly override preset values', () => {
    const presets: Presets = {
      fields: {
        status: { widget: 'radio-group', options: ['a', 'b'] },
        title: { widget: 'input', disabled: true, readOnly: true },
      },
      labels,
    };
    const meta: FormSchema = {
      fields: [
        {
          key: 'status',
          options: [['active', '活跃']],
          disabled: false,
        },
        { key: 'title', disabled: false, readOnly: false },
      ],
    };
    render(<SchemaForm meta={meta} presets={presets} />);

    expect(screen.getByText('活跃')).toBeInTheDocument();
    expect(screen.queryByText('a')).not.toBeInTheDocument();
    const input = document.querySelector('input.ant-input') as HTMLInputElement;
    expect(input).not.toBeDisabled();
    expect(input).not.toHaveAttribute('readonly');
  });
});

describe('preset props and registries', () => {
  it('passes preset props to a custom widget', () => {
    function Custom(props: Record<string, any>) {
      return <div data-testid="custom" data-placeholder={props.placeholder} />;
    }

    const presets: Presets = {
      fields: { title: { widget: 'custom', placeholder: '自定义占位' } },
      labels,
    };
    render(
      <SchemaForm
        meta={{ fields: [{ key: 'title' }] }}
        presets={presets}
        widgets={{ custom: { component: Custom } }}
      />,
    );

    expect(screen.getByTestId('custom')).toHaveAttribute('data-placeholder', '自定义占位');
  });

  it('reports an unknown widget id coming from a preset object', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(() =>
        render(
          <SchemaForm
            meta={{ fields: [{ key: 'title' }] }}
            presets={{ fields: { title: { widget: 'missing' } } }}
          />,
        ),
      ).toThrow(/unregistered widget "missing"/);
    } finally {
      warn.mockRestore();
    }
  });

  it('replaces the whole preset object for the same key across config levels', () => {
    configureSchemaForm({
      presets: {
        fields: { title: { widget: 'input', placeholder: '全局占位' } },
        labels,
      },
    });

    render(
      <SchemaForm
        meta={{ fields: [{ key: 'title' }] }}
        presets={{
          fields: { title: { widget: 'input', placeholder: '表单占位' } },
        }}
      />,
    );

    expect(screen.getByPlaceholderText('表单占位')).toBeInTheDocument();
  });
});
