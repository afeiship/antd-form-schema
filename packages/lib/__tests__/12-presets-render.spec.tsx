import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SchemaForm } from '../src';
import type { FormSchema, Presets } from '../src/core/types';

afterEach(cleanup);

const presets: Presets = {
  fields: { title: 'input', status: { widget: 'select' } },
  labels: { 'zh-CN': { title: '标题', status: '状态' }, 'en-US': { title: 'Title' } },
};

const meta: FormSchema = { fields: [{ key: 'title' }, { key: 'status' }] };

describe('SchemaForm presets', () => {
  it('renders label and widget for bare keys', () => {
    const { container } = render(<SchemaForm meta={meta} presets={presets} />);
    expect(screen.getByText('标题')).toBeInTheDocument();
    expect(container.querySelector('input')).toBeInTheDocument();
    expect(container.querySelector('.ant-select')).toBeInTheDocument();
  });

  it('lets schema override preset widget', () => {
    const { container } = render(
      <SchemaForm meta={{ fields: [{ key: 'title', widget: 'textarea' }] }} presets={presets} />,
    );
    expect(container.querySelector('textarea')).toBeInTheDocument();
    expect(container.querySelector('input')).toBeNull();
  });

  it('resolves labels for the requested locale', () => {
    render(<SchemaForm meta={{ fields: [{ key: 'title' }] }} presets={presets} locale="en-US" />);
    expect(screen.getByText('Title')).toBeInTheDocument();
  });

  it('silently falls back to zh-CN when the locale table is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(<SchemaForm meta={{ fields: [{ key: 'title' }] }} presets={presets} locale="ja-JP" />);
      expect(screen.getByText('标题')).toBeInTheDocument();
      expect(warn.mock.calls.filter(([msg]) => String(msg).includes('preset'))).toHaveLength(0);
    } finally {
      warn.mockRestore();
    }
  });
});
