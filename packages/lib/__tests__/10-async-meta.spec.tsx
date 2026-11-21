import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import { SchemaForm } from '../src';

const syncMeta = { fields: [{ key: 'name', label: 'Name', widget: 'input' }] } as any;

describe('SchemaForm async meta', () => {
  it('renders Spin placeholder while pending, no <form> element', () => {
    let resolveMeta: (m: any) => void = () => {};
    const promise = new Promise((r) => (resolveMeta = r));
    const { container } = render(<SchemaForm meta={promise} />);
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('.ant-spin')).toBeInTheDocument();
    resolveMeta(syncMeta);
  });

  it('renders fields and applies initialValues after resolve', async () => {
    const promise = Promise.resolve({
      ...syncMeta,
      initialValues: { name: 'Alice' },
    });
    render(<SchemaForm meta={promise} />);
    await waitFor(() => expect(document.querySelector('form')).toBeInTheDocument());
    expect((document.querySelector('.ant-input') as HTMLInputElement).value).toBe('Alice');
  });

  it('renders custom error placeholder on reject', async () => {
    const promise = Promise.reject(new Error('boom'));
    render(<SchemaForm meta={promise} error={<div>failed</div>} />);
    await waitFor(() => expect(screen.getByText('failed')).toBeInTheDocument());
    expect(document.querySelector('form')).toBeNull();
  });

  it('renders nothing (no throw) on reject without error prop', async () => {
    const promise = Promise.reject(new Error('boom'));
    promise.catch(() => {}); // suppress unhandled rejection
    const { container } = render(<SchemaForm meta={promise} />);
    await waitFor(() => expect(container.querySelector('.ant-spin')).toBeNull());
    expect(container.querySelector('form')).toBeNull();
  });

  it('last promise wins when the prop changes', async () => {
    const slow = new Promise<{ fields: any[] }>((r) =>
      setTimeout(() => r({ fields: [{ key: 'slow', label: 'Slow' }] }), 100),
    );
    const fast = Promise.resolve({ fields: [{ key: 'fast', label: 'Fast' }] });
    const { rerender } = render(<SchemaForm meta={slow} />);
    rerender(<SchemaForm meta={fast} />);
    await waitFor(() => expect(screen.getByText('Fast')).toBeInTheDocument());
    expect(screen.queryByText('Slow')).toBeNull();
  });
});

import { Form } from 'antd';
import { SchemaFields } from '../src';

describe('SchemaFields async meta', () => {
  it('renders placeholder inside an external Form while pending, then fields', async () => {
    let resolveMeta: (m: any) => void = () => {};
    const promise = new Promise((r) => (resolveMeta = r));
    const { container } = render(
      <Form>
        <SchemaFields meta={promise} />
      </Form>,
    );
    expect(container.querySelector('.ant-spin')).toBeInTheDocument();
    resolveMeta(syncMeta);
    await waitFor(() => expect(document.querySelector('.ant-input')).toBeInTheDocument());
  });

  it('custom loading node replaces the default Spin', () => {
    const never = new Promise<{ fields: any[] }>(() => {});
    render(
      <Form>
        <SchemaFields meta={never} loading={<div>fetching…</div>} />
      </Form>,
    );
    expect(screen.getByText('fetching…')).toBeInTheDocument();
  });
});
