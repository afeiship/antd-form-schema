# Async Meta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `SchemaForm` / `SchemaFields` accept `meta` as `FormSchema | Promise<FormSchema>`, rendering a loading placeholder until it resolves and an error placeholder if it rejects.

**Architecture:** A small internal hook `useResolvedMeta(meta)` resolves async meta with last-write-wins cancellation; while pending, components render the `loading` placeholder instead of the `<Form>` (delayed mount sidesteps antd's uncontrolled `initialValues`). Sync meta passes straight through — zero behavior change.

**Tech Stack:** React 18, antd 5, TypeScript, vitest + @testing-library/react, tsup.

**Spec:** `docs/superpowers/specs/2026-11-21-async-meta-design.md`

## Global Constraints

- Sync `meta: FormSchema` behavior must stay byte-identical (all 108 existing tests pass untouched).
- Placeholder props: `loading?: ReactNode` (default antd `<Spin />`), `error?: ReactNode` (default `null`).
- `useFormSchema` hook stays sync-only; no async support there.
- No request management (fetch/cache/cancel) — the library only receives a Promise.
- pnpm; tests: `pnpm test` run from `packages/lib` (vitest config lives there; running from repo root fails).
- English commit messages and code comments.

## Review Focus

1. **New Promise reference each render** — a parent recreating the Promise (e.g. inline `fetchMeta()` in JSX) must not loop or leak: last resolve wins, stale resolve is ignored via a cancelled flag. Test: two sequential promises, only the last one's fields render (Task 1).
2. **`<Form>` must not exist while pending** — if the Form mounts with empty meta, antd registers fields and initialValues won't apply later. Test asserts `document.querySelector('form')` is null while pending (Task 1).
3. **Sync prop typing** — existing callers passing plain `FormSchema` must compile unchanged; the type is a union, not a rename. Pinned by the untouched 108-test suite compiling (Task 1 verification).
4. **SchemaFields inside a pre-existing external Form** — SchemaFields pending must not throw (`Form.useFormInstance` error path only applies after mount; while pending we return placeholder before calling the hook). Test: external Form + async meta renders placeholder, then fields (Task 2).
5. **Reject without `error` prop** — default placeholder is `null`; no console crash, form area stays empty. Test: rejected promise renders nothing, no throw (Task 1).

---

### Task 1: useResolvedMeta hook + SchemaForm async support

**Files:**
- Create: `packages/lib/src/components/use-resolved-meta.ts`
- Modify: `packages/lib/src/components/SchemaForm.tsx`
- Modify: `packages/lib/src/components/SchemaFields.tsx` (props type only — hook consumed fully in Task 2)
- Test: `packages/lib/__tests__/10-async-meta.spec.tsx`

**Interfaces:**
- Produces: `useResolvedMeta(meta: FormSchema | Promise<FormSchema>): { meta: FormSchema | undefined; error: unknown; pending: boolean }` — exported from `src/components/use-resolved-meta.ts`. New props on both `SchemaFieldsProps` and `SchemaFormProps`: `loading?: ReactNode; error?: ReactNode`.

- [ ] **Step 1: Write the failing tests** in `packages/lib/__tests__/10-async-meta.spec.tsx` (new file; use `render`, `screen`, `waitFor` from @testing-library/react, style matching `08-schema-form.spec.tsx`):

```tsx
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
    const slow = new Promise<{ fields: any[] }>((r) => setTimeout(() => r({ fields: [{ key: 'slow', label: 'Slow' }] }), 100));
    const fast = Promise.resolve({ fields: [{ key: 'fast', label: 'Fast' }] });
    const { rerender } = render(<SchemaForm meta={slow} />);
    rerender(<SchemaForm meta={fast} />);
    await waitFor(() => expect(screen.getByText('Fast')).toBeInTheDocument());
    expect(screen.queryByText('Slow')).toBeNull();
  });
});
```

- [ ] **Step 2: Run** `pnpm vitest run 10-async-meta` from `packages/lib`. Expected: FAIL — SchemaForm currently renders a form (or throws) for a promise meta.

- [ ] **Step 3: Implement `useResolvedMeta`** in `packages/lib/src/components/use-resolved-meta.ts`:

```ts
import { useEffect, useState } from 'react';
import type { FormSchema } from '../core/types';

export type AsyncMeta = FormSchema | Promise<FormSchema>;

export interface ResolvedMeta {
  meta: FormSchema | undefined;
  error: unknown;
  pending: boolean;
}

/** Resolve sync-or-promise meta; last prop wins, stale resolves are ignored. */
export function useResolvedMeta(meta: AsyncMeta): ResolvedMeta {
  const [state, setState] = useState<ResolvedMeta>(() =>
    isPromise(meta) ? { meta: undefined, error: undefined, pending: true } : { meta, error: undefined, pending: false },
  );
  useEffect(() => {
    if (!isPromise(meta)) {
      setState({ meta, error: undefined, pending: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, pending: true, error: undefined }));
    meta.then(
      (resolved) => { if (!cancelled) setState({ meta: resolved, error: undefined, pending: false }); },
      (error) => { if (!cancelled) setState({ meta: undefined, error, pending: false }); },
    );
    return () => { cancelled = true; };
  }, [meta]);
  return state;
}

function isPromise(value: AsyncMeta): value is Promise<FormSchema> {
  return typeof (value as Promise<FormSchema>)?.then === 'function';
}
```

- [ ] **Step 4: Wire into `SchemaForm.tsx`** — props type gains `loading?: ReactNode; error?: ReactNode`; body: `const { meta: resolved, error: resolvedError, pending } = useResolvedMeta(meta);` then early return `pending ? renderPlaceholder(loading, <Spin />) : resolvedError ? renderPlaceholder(error, null) : <Form ...>` (keep the existing Form/SchemaFields JSX as the final branch, using `resolved` wherever `meta` was used). `renderPlaceholder(node, fallback)` renders `node ?? fallback`. Import `Spin` from antd.

- [ ] **Step 5: Run** `pnpm vitest run 10-async-meta`. Expected: PASS (5 tests).

- [ ] **Step 6: Run full suite** `pnpm test`. Expected: 108 existing + 5 new, all pass — proves sync typing unchanged.

- [ ] **Step 7: Commit**

```bash
git add packages/lib/src/components/use-resolved-meta.ts packages/lib/src/components/SchemaForm.tsx packages/lib/__tests__/10-async-meta.spec.tsx
git commit -m "feat(lib): SchemaForm accepts async meta with loading/error placeholders"
```

### Task 2: SchemaFields async support

**Files:**
- Modify: `packages/lib/src/components/SchemaFields.tsx`
- Test: `packages/lib/__tests__/10-async-meta.spec.tsx`

**Interfaces:**
- Consumes: `useResolvedMeta` from Task 1.
- Produces: `SchemaFieldsProps.meta: FormSchema | Promise<FormSchema>` plus the same `loading`/`error` props. While pending or errored, returns the placeholder **before** calling `Form.useFormInstance()`/`useFormSchema` (so external-Form usage never throws while pending).

- [ ] **Step 1: Write failing tests** (append to `10-async-meta.spec.tsx`):

```tsx
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

  it('custom loading node replaces the default Spin', async () => {
    const never = new Promise<{ fields: any[] }>(() => {});
    render(
      <Form>
        <SchemaFields meta={never} loading={<div>fetching…</div>} />
      </Form>,
    );
    expect(screen.getByText('fetching…')).toBeInTheDocument();
  });
});
```

(Add `SchemaFields` and `Form` to the imports already present in the spec file.)

- [ ] **Step 2: Run** `pnpm vitest run 10-async-meta`. Expected: FAIL — SchemaFields currently throws or crashes on promise meta.

- [ ] **Step 3: Implement in `SchemaFields.tsx`** — hoist `useResolvedMeta` to the top of the component; early-return `loading ?? <Spin />` when pending, `error ?? null` when errored — **before** the `Form.useFormInstance()` call. Then use the resolved meta in `useFormSchema` as before.

- [ ] **Step 4: Run** `pnpm vitest run 10-async-meta`. Expected: PASS.

- [ ] **Step 5: Full suite** `pnpm test`. Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/lib/src/components/SchemaFields.tsx packages/lib/__tests__/10-async-meta.spec.tsx
git commit -m "feat(lib): SchemaFields accepts async meta"
```

### Task 3: Docs + build verification

**Files:**
- Modify: `packages/lib/README.md` (notes list, after the valueType line)

- [ ] **Step 1: Add one README line** to the notes list:

```markdown
- `meta` may be a `Promise<FormSchema>` — components render a loading placeholder until it resolves (`loading`/`error` props customize the placeholders). Fields mount only after resolve, so late `initialValues` apply correctly.
```

- [ ] **Step 2: Final verify** `pnpm build && pnpm test` in `packages/lib`. Expected: build success (d.ts includes the union type), all tests pass.

- [ ] **Step 3: Commit (only if README changed)**

```bash
git add packages/lib/README.md
git commit -m "docs(lib): document async meta support"
```
