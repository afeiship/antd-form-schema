# Form Slots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `SchemaFields`/`SchemaForm` 上加部件级 slots（label/field/control/error），复用 `@jswork/react-list` 的 `Slot`/`renderSlot` 三形态，让使用者只替换需要的部件而不丢开箱即用。

**Architecture:** `slots.tsx` 提供 `FormSlots` 类型与四个默认渲染器；`SchemaFields` 用 `renderSlot` 逐部件渲染，未提供 slot 时走与现状等价的默认实现。错误由一个叠在控件下的 `Form.Item shouldUpdate` 渲染器接管，保证自定义 error slot 能拿到 `form.getFieldError()` 且错误始终可见。核心 hook/纯函数不动。

**Tech Stack:** pnpm workspace、TypeScript、React 18、antd 5、`@jswork/react-list`（slot helpers）、tsup、vitest + RTL、Vite + Tailwind 3。

**Spec:** `docs/superpowers/specs/2026-11-20-form-slots-design.md`

## Global Constraints

- 依赖 `@jswork/react-list` 加到 lib 的 `dependencies`（npm 发布版 2.0.18，导出 `renderSlot`/`isSlotConfig`/`Slot`）。
- slot 三形态来自 react-list：Component / ReactNode / `{component, props}`；运行时 props 覆盖 slot 配置默认 props。
- 四个部件 slot：`label` / `field` / `control` / `error`，各自收到 `field: BoundField`（及对应上下文）。
- 未提供 slot 时，渲染与行为必须与现状等价；**错误文案必须可见**（默认 error 渲染器等价于 antd 旧表现）。
- `slots` 是组件 props，绝不进 Schema；`itemProps` 仍只含数据绑定键。
- `SchemaForm` 把 `slots` 透传给 `SchemaFields`；className 系列保持现状。
- `FormSlots` 从 lib 根 named export；不重复定义 `Slot`。
- 代码标识符、注释、提交信息用英文；文档中文；不推送远程。

## Review Focus

1. **只替换一个部件，其余保持默认**：`slots={{ label: CustomLabel }}` 时 control/error/field 仍是默认实现 → Task 1 测试。
2. **slot 三形态**：Component、ReactNode、`{component, props}` 都能渲染，props 覆盖顺序正确 → Task 1 测试。
3. **不提供 error slot 时错误仍可见**：当前 `Form.Item` 无 `noStyle` 会显示错误；改造成独立 error 渲染器后不能退化 → Task 1 测试（提交空必填断言错误文案出现）。
4. **自定义 error slot 收到 errors 数组**：`form.getFieldError(field.name)` 的值传入 slot → Task 1 测试。
5. **`slots` 从 SchemaForm 透传到 SchemaFields**：`SchemaForm` 上传的自定义 label 实际生效 → Task 2 测试。

---

## File Structure

```
packages/lib/src/
├── slots.tsx              # FormSlots 类型 + 四个默认渲染器
├── SchemaFields.tsx       # 接入 slots（modify）
├── SchemaForm.tsx         # slots 透传（modify）
└── index.tsx              # named export FormSlots（modify）
packages/lib/package.json  # add @jswork/react-list dependency
packages/lib/__tests__/09-slots.spec.tsx
packages/example/src/components/slots-demo.tsx
packages/example/src/app.tsx
packages/lib/README.md
```

---

### Task 1: 依赖 + slots 核心 + SchemaFields 接入

**Files:**
- Modify: `packages/lib/package.json`（add dependency）
- Create: `packages/lib/src/slots.tsx`
- Modify: `packages/lib/src/SchemaFields.tsx`
- Modify: `packages/lib/src/index.tsx`
- Test: `packages/lib/__tests__/09-slots.spec.tsx`

**Interfaces:**
- Consumes: `renderSlot`, `Slot` from `@jswork/react-list`；`BoundField` / `FormItemProps` from `./types`；`useFormSchema` (existing).
- Produces:
  - `FormSlots` type with `label` / `field` / `control` / `error` slots.
  - `renderLabel` / `renderField` / `renderControl` / `renderError` default renderers (internal, not exported from root unless needed).
  - `SchemaFields` accepts `slots?: FormSlots`.

- [ ] **Step 1: 安装依赖**

`pnpm --filter @jswork/antd-form-schema add @jswork/react-list@^2.0.18`。确认 `packages/lib/package.json` 的 `dependencies` 出现 `@jswork/react-list`，`pnpm install` 成功。

- [ ] **Step 2: 写失败测试**

创建 `09-slots.spec.tsx`（用 `Form`/`SchemaFields` 真实渲染）：
```tsx
it('uses a custom label slot without losing the default control', () => {
  const Label = ({ field }: { field: BoundField }) => <b data-testid="custom-label">{String(field.label)}?</b>;
  render(<Form><SchemaFields meta={{ fields: [{ key: 'name', label: 'Name', widget: 'input' }] }} slots={{ label: Label }} /></Form>);
  expect(screen.getByTestId('custom-label')).toHaveTextContent('Name?');
  expect(document.querySelector('input')).toBeInTheDocument();
});
it('accepts a ReactNode slot and a {component, props} slot', () => {
  render(<Form><SchemaFields meta={{ fields: [{ key: 'a', label: 'A', widget: 'input' }, { key: 'b', label: 'B', widget: 'input' }] }} slots={{ label: <i>NODE</i> }} /></Form>);
  expect(screen.getAllByText('NODE').length).toBe(2);
});
it('renders default validation error when no error slot is provided', async () => {
  render(<Form><SchemaFields meta={{ fields: [{ key: 'name', label: 'Name', required: true, widget: 'input' }] }} /><button type="submit">Go</button></Form>);
  fireEvent.click(screen.getByText('Go'));
  expect(await screen.findByText(/required/i)).toBeInTheDocument();
});
it('passes form errors to a custom error slot', async () => {
  const ErrorView = vi.fn(({ errors }: { errors: string[] }) => <div data-testid="err">{errors.join('|')}</div>);
  render(<Form><SchemaFields meta={{ fields: [{ key: 'name', label: 'Name', required: true, widget: 'input' }] }} slots={{ error: ErrorView }} /><button type="submit">Go</button></Form>);
  fireEvent.click(screen.getByText('Go'));
  await waitFor(() => expect(ErrorView).toHaveBeenCalled());
  expect(screen.getByTestId('err').textContent).toMatch(/required/i);
});
```
运行 `pnpm --filter @jswork/antd-form-schema test -- 09-slots`，确认 FAIL。

- [ ] **Step 3: 实现 slots.tsx**

`FormSlots = { label?: Slot<{field: BoundField}>; field?: Slot<{field: BoundField; children: ReactNode}>; control?: Slot<{field: BoundField; control: ReactNode; itemProps: FormItemProps}>; error?: Slot<{field: BoundField; errors: string[]}> }`。默认渲染器：
- `renderLabel`: `<label className={labelClassName}>{field.label}{field.required && <span aria-hidden="true"> *</span>}</label>`
- `renderField`: `<div className={itemClassName}>{children}</div>`
- `renderControl`: `<div className={controlClassName}><Form.Item {...itemProps} noStyle>{control}</Form.Item></div>`（注意：noStyle 只给控件绑定，错误由 error 渲染器出）
- `renderError`: `{errors.length > 0 ? <div role="alert">{errors.join(', ')}</div> : null}`

不要把 `Form` 实例存进 slots 上下文（用 hook 内已有的 form）。

- [ ] **Step 4: 改造 SchemaFields.tsx**

`slots` 加入 props。每个字段：
```tsx
const body = (
  <>
    {renderSlot(slots?.label, { field }, field.key + '-label')}
    {renderSlot(slots?.control, { field, control: field.control, itemProps: field.itemProps }, field.key + '-control')}
    <Form.Item noStyle shouldUpdate>
      {() => renderSlot(slots?.error ?? DefaultError, { field, errors: form.getFieldError(field.name) }, field.key + '-error')}
    </Form.Item>
  </>
);
return renderSlot(slots?.field, { field, children: body }, field.key) ?? ...
```
注意：未提供 `slots.field` 时必须用默认 `renderField` 包 body；`renderSlot` 对 undefined 返回 null，不能让字段消失。className 只喂默认渲染器。

- [ ] **Step 5: 加 named export**

`index.tsx` 加 `export type { FormSlots } from './slots';`。

- [ ] **Step 6: 验证**

Run: `pnpm --filter @jswork/antd-form-schema test -- 09-slots && pnpm test`
预期：新增 4 条 PASS，全部 79/79 通过；`pnpm exec tsc --noEmit -p packages/lib/tsconfig.json` 干净。

- [ ] **Step 7: Commit**

`git add packages/lib && git commit -m "feat: add component-level slots to SchemaFields"`

---

### Task 2: SchemaForm 透传 + example + README

**Files:**
- Modify: `packages/lib/src/SchemaForm.tsx`
- Create: `packages/example/src/components/slots-demo.tsx`
- Modify: `packages/example/src/app.tsx`
- Modify: `packages/lib/README.md`

**Interfaces:**
- Consumes: Task 1 的 `FormSlots`。
- Produces: `SchemaForm` 接受并透传 `slots`；example demo；文档。

- [ ] **Step 1: 写失败测试**

在 `09-slots.spec.tsx` 追加：
```tsx
it('passes slots through SchemaForm', () => {
  const Label = () => <b data-testid="slot-label">SLOT</b>;
  render(<SchemaForm meta={{ fields: [{ key: 'name', label: 'Name', widget: 'input' }] }} slots={{ label: Label }} />);
  expect(screen.getByTestId('slot-label')).toBeInTheDocument();
});
```
运行确认 FAIL（`slots` 未被透传）。

- [ ] **Step 2: SchemaForm 透传**

`SchemaFormProps` 加 `slots?: FormSlots`，解构后传给 `<SchemaFields slots={slots} ... />`。

- [ ] **Step 3: example demo**

新建 `slots-demo.tsx`：`slots` 用三个自定义——`label` 带 tooltip（简单 `<abbr title>`）、`control` 在控件旁加单位 `<span>`、`error` 用红色文案；下方保留一组不传 slots 的对照。`app.tsx` 的 `demos` 加 `{ key: 'slots', title: 'Slots', Component: SlotsDemo }`。

- [ ] **Step 4: README**

新增 `## slots` 一节：四个部件名、三形态说明、最小示例、默认不退化说明。

- [ ] **Step 5: 全量验证**

Run: `pnpm test && pnpm build && pnpm --filter example build && pnpm dev`（dev server 确认 HTTP 200 即可，不截图/dump-dom）。

- [ ] **Step 6: Commit**

`git add packages/lib packages/example && git commit -m "feat: add slots demo and SchemaForm passthrough"`

---

### Task 3: 最终审查

**Files:** 无新增

- [ ] **Step 1: 全量验证**：`pnpm test` 全绿、`pnpm build`、`node -e` 验证 CJS/ESM 含 `FormSlots` 类型导出与 `SchemaForm` 正常导出。
- [ ] **Step 2: 验收核对**：对照 spec 交付与验收逐项核对。
- [ ] **Step 3: Commit（如有修复）**：仅在有改动时提交。
