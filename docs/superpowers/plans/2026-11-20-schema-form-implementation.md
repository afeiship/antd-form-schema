# SchemaForm / SchemaFields 便捷层 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 headless 核心之上新增两个开箱即用的渲染组件（`SchemaFields` 字段渲染器 + `SchemaForm` 内部建 Form 的一行式表单），让普通场景免去手写 JSX 样板，同时极端定制继续用 `useFormSchema`。

**Architecture:** `SchemaFields` 通过 `Form.useFormInstance()` 从 antd Form 上下文取 form，调用 `useFormSchema` 得到 `visibleFields`，渲染 className 驱动的字段网格（label + 星号 + 无 `noStyle` 的 `Form.Item`，校验错误可见）。`SchemaForm` 内部 `Form.useForm()` + `<Form initialValues={meta.initialValues}>` + 渲染 `SchemaFields` + `children`。两个组件共享 `SchemaFields` 的渲染实现，不动任何核心纯函数/hook。

**Tech Stack:** pnpm workspace、TypeScript、React 18、antd 5、tsup、vitest + @testing-library/react + jsdom、Vite + Tailwind 3。

**Spec:** `docs/superpowers/specs/2026-11-20-schema-form-design.md`

## Global Constraints

- 新增 named export `SchemaFields`、`SchemaForm`；现有 `useFormSchema`/`FormFields`/default 全部不改。
- `SchemaFields` 不接收 `form` prop，用 `Form.useFormInstance()` 从上下文取；必须在 `<Form>` 内部使用。
- `SchemaForm` 内部 `Form.useForm()`；初值**只取 `meta.initialValues`**，不提供 `initialValues` prop；`onFormReady(form)` 逃生舱用 effect 挂载后回调一次。
- `Form.Item` **不带 `noStyle`**（校验错误可见）。
- className 控制点四处：`className`（字段列表容器 div）、`itemClassName`、`labelClassName`、`controlClassName`。DOM 结构按 spec §已拍板的设计第 2 条，grid 容器必须是字段外层 div 的直接父节点。
- Schema 仍零布局 / 零样式键；className props 在组件层，不进 Schema。
- `widgets` 透传给 `useFormSchema(meta, form, { widgets })`；条件显隐、查看态、options 归一化全部沿用 hook。
- 代码标识符、注释、提交信息用英文；文档中文；提交信息英文。

## Review Focus

1. **SchemaFields 脱离 `<Form>` 使用**：`Form.useFormInstance()` 返回 null → `useFormSchema` 传入 null form 会崩。合理预期：组件内给出明确错误提示。→ Task 1 测试：渲染 `<SchemaFields>` 不包 `<Form>` 时断言抛出/警告明确错误。
2. **grid className 不生效**：若 `className` 落在包住 `<Form>` 的最外层 div 而非字段列表 div，Tailwind grid 对字段无效。→ Task 1 测试：断言带 `className` 的 div 直接包含字段 item div。
3. **初值来源错误**：`SchemaForm` 若误用 prop 或忽略 `meta.initialValues`，编辑回填失效。→ Task 2 测试：`meta.initialValues` 的字段在渲染后控件显示该初值。
4. **校验错误不可见**：`Form.Item` 若误加 `noStyle`，错误文案消失。→ Task 2 测试：提交空必填后断言错误文案出现。
5. **onFormReady 重复触发**：每次 render 回调会让使用者的 effect 反复执行。→ Task 2 测试：rerender 后回调次数仍为 1。

---

## File Structure

```
packages/lib/src/
├── SchemaFields.tsx   # 字段渲染器（useFormSchema + className 网格）
├── SchemaForm.tsx     # 内部 Form 包装（Form.useForm + SchemaFields + children）
└── index.tsx          # 加两个 named export
packages/lib/__tests__/
└── 08-schema-form.spec.tsx   # 两个组件的测试
packages/example/src/
├── components/schema-form-demo.tsx   # 一行式 + SchemaFields 并存的 demo
└── app.tsx                            # demos 数组加一项
packages/lib/README.md                 # 新增 SchemaForm / SchemaFields 一节
```

---

### Task 1: SchemaFields 字段渲染器

**Files:**
- Create: `packages/lib/src/SchemaFields.tsx`
- Modify: `packages/lib/src/index.tsx`
- Test: `packages/lib/__tests__/08-schema-form.spec.tsx`

**Interfaces:**
- Consumes: `useFormSchema(meta, form, options?) => UseFormSchemaResult`（现有）；`FormSchema` / `WidgetDef` 类型（现有 `types.ts`）。
- Produces: `SchemaFields: FC<SchemaFieldsProps>`，`SchemaFieldsProps = { meta: FormSchema; widgets?: Record<string, WidgetDef>; className?: string; itemClassName?: string; labelClassName?: string; controlClassName?: string }`；named export from index。

- [ ] **Step 1: 写失败测试**

创建 `08-schema-form.spec.tsx`，`describe('SchemaFields')`：
```tsx
it('renders fields from meta inside a Form with className hooks', () => {
  render(
    <Form>
      <SchemaFields
        meta={{ fields: [{ key: 'name', label: 'Name', required: true, widget: 'input' }] }}
        className="grid grid-cols-2"
        itemClassName="item-cls"
        labelClassName="label-cls"
        controlClassName="control-cls"
      />
    </Form>,
  );
  const grid = document.querySelector('.grid');
  expect(grid).toBeInTheDocument();
  expect(grid?.querySelector('.item-cls')).toBeInTheDocument();
  expect(grid?.querySelector('.label-cls')).toHaveTextContent('Name');
  expect(grid?.querySelector('.label-cls')).toHaveTextContent('*');
  expect(grid?.querySelector('.control-cls input')).toBeInTheDocument();
});
it('hides fields whose declarative condition is false', () => {
  const meta: FormSchema = { fields: [
    { key: 'role', widget: 'input' },
    { key: 'company', widget: 'input', condition: { field: 'role', op: 'eq', value: 'admin' } },
  ] };
  render(<Form initialValues={{ role: 'user' }}><SchemaFields meta={meta} /></Form>);
  // default input has no name label; assert via Form.Item presence by value count
  expect(document.querySelectorAll('input').length).toBe(1);
});
it('throws a clear error when used outside a Form', () => {
  expect(() => render(<SchemaFields meta={{ fields: [] }} />)).toThrow(/must be used inside/i);
});
```
运行 `pnpm --filter @jswork/antd-form-schema test -- 08-schema-form`，确认 FAIL（模块不存在）。

- [ ] **Step 2: 实现 SchemaFields.tsx**

签名与结构按 spec：`export interface SchemaFieldsProps { ... }`；组件内 `const form = Form.useFormInstance(); if (!form) throw new Error('SchemaFields must be used inside a <Form>.');` 然后 `const { visibleFields } = useFormSchema(meta, form, { widgets });`，返回：
```tsx
<div className={className}>
  {visibleFields.map(f => (
    <div className={itemClassName} key={f.key}>
      <label className={labelClassName}>{f.label}{f.required && <span aria-hidden="true"> *</span>}</label>
      <div className={controlClassName}>
        <Form.Item {...f.itemProps}>{f.control}</Form.Item>
      </div>
    </div>
  ))}
</div>
```
`Form.Item` **不带 `noStyle`**。不要用 `data-component`（新组件不需要 scaffold 标记）。

- [ ] **Step 3: 加 named export**

在 `packages/lib/src/index.tsx` 加 `export { default as SchemaFields } from './SchemaFields';`，放在 `FormFields` 导出之后；不动 default export。

- [ ] **Step 4: 运行测试**

Run: `pnpm --filter @jswork/antd-form-schema test -- 08-schema-form`
预期：3 条 SchemaFields 测试 PASS。

- [ ] **Step 5: Commit**

`git add packages/lib/src/SchemaFields.tsx packages/lib/src/index.tsx packages/lib/__tests__/08-schema-form.spec.tsx && git commit -m "feat: add SchemaFields renderer with className hooks"`

---

### Task 2: SchemaForm 内部建 Form 包装

**Files:**
- Create: `packages/lib/src/SchemaForm.tsx`
- Modify: `packages/lib/src/index.tsx`
- Test: `packages/lib/__tests__/08-schema-form.spec.tsx`（追加）

**Interfaces:**
- Consumes: Task 1 的 `SchemaFields` 与 `SchemaFieldsProps`（复用字段渲染 props 类型）；`FormProps` / `FormInstance` from antd。
- Produces: `SchemaForm: FC<SchemaFormProps>`；`SchemaFormProps extends Omit<FormProps, 'form'> , SchemaFieldsProps`，额外 `onFormReady?: (form: FormInstance) => void` 与 `children?: ReactNode`；named export from index。

- [ ] **Step 1: 写失败测试**

在 `08-schema-form.spec.tsx` 追加 `describe('SchemaForm')`：
```tsx
it('creates an internal form and applies meta.initialValues', () => {
  render(
    <SchemaForm meta={{ initialValues: { name: 'Alice' }, fields: [{ key: 'name', label: 'Name', widget: 'input' }] }}>
      <button type="submit">Submit</button>
    </SchemaForm>,
  );
  // label 未与控件用 htmlFor 关联，直接取 DOM 控件值（不要 getByLabelText）
  expect((document.querySelector('.ant-input') as HTMLInputElement).value).toBe('Alice');
});
```

```tsx
it('shows validation errors (Form.Item is not noStyle)', async () => {
  render(<SchemaForm meta={{ fields: [{ key: 'name', label: 'Name', required: true, widget: 'input' }] }}><button type="submit">Submit</button></SchemaForm>);
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  expect(await screen.findByText(/required/i)).toBeInTheDocument();
});
it('calls onFormReady once with the internal form instance', () => {
  const onFormReady = vi.fn();
  const { rerender } = render(<SchemaForm meta={{ fields: [] }} onFormReady={onFormReady} />);
  rerender(<SchemaForm meta={{ fields: [] }} onFormReady={onFormReady} />);
  expect(onFormReady).toHaveBeenCalledTimes(1);
  expect(onFormReady.mock.calls[0][0]).toHaveProperty('getFieldsValue');
});
it('renders children after the field grid', () => {
  render(<SchemaForm meta={{ fields: [{ key: 'name', label: 'Name', widget: 'input' }] }} className="grid-cls"><button type="submit">Go</button></SchemaForm>);
  const grid = document.querySelector('.grid-cls')!;
  expect(grid.nextElementSibling).toHaveTextContent('Go');
});
```
运行确认 FAIL（SchemaForm 未导出）。

- [ ] **Step 2: 实现 SchemaForm.tsx**

签名按 Interfaces；实现：`const [form] = Form.useForm(); const readyRef = useRef(false); useEffect(() => { if (!readyRef.current) { readyRef.current = true; onFormReady?.(form); } }, [form, onFormReady]);` 返回：
```tsx
<Form form={form} initialValues={meta.initialValues} {...rest}>
  <SchemaFields meta={meta} widgets={widgets} className={className} itemClassName={itemClassName} labelClassName={labelClassName} controlClassName={controlClassName} />
  {children}
</Form>
```
`rest` 从 props 解构剩余（已去掉 meta/widgets/className 系列/onFormReady/children），不透传 `form`/`initialValues`。

- [ ] **Step 3: 加 named export**

`packages/lib/src/index.tsx` 加 `export { default as SchemaForm } from './SchemaForm';`。

- [ ] **Step 4: 运行测试**

Run: `pnpm --filter @jswork/antd-form-schema test -- 08-schema-form`
预期：SchemaForm 4 条 + SchemaFields 3 条全 PASS。

- [ ] **Step 5: Commit**

`git add packages/lib/src/SchemaForm.tsx packages/lib/src/index.tsx packages/lib/__tests__/08-schema-form.spec.tsx && git commit -m "feat: add SchemaForm with internal form instance"`

---

### Task 3: example demo、README、全量验证

**Files:**
- Create: `packages/example/src/components/schema-form-demo.tsx`
- Modify: `packages/example/src/app.tsx`
- Modify: `packages/lib/README.md`

**Interfaces:**
- Consumes: Task 1/2 的 `SchemaFields` / `SchemaForm` named exports。
- Produces: 可访问的一行式 demo；文档更新。

- [ ] **Step 1: 写 example demo**

`schema-form-demo.tsx`：
- 上半区：`<SchemaForm meta={basicMeta} className="grid grid-cols-1 gap-4 md:grid-cols-2" itemClassName="..." labelClassName="..." controlClassName="..." onFinish={(values) => message.success(...)}><Button htmlType="submit" type="primary">Submit</Button></SchemaForm>`（一行式）。
- 下半区：外部 form 的 `<Form form={form} onFinish={...}><SchemaFields meta={basicMeta} className="grid grid-cols-2 gap-4" /><Button htmlType="submit">Submit</Button></Form>`，旁边写一句说明展示两种用法共存。
- 全部布局用 Tailwind className；不看 schema 布局键。

- [ ] **Step 2: 接入 app.tsx**

在 `demos` 数组加 `{ key: 'schema-form', title: 'Quick Form', Component: SchemaFormDemo }`（放在首位之后），import 对应组件。

- [ ] **Step 3: 更新 README**

在 `packages/lib/README.md` 的 convenience renderer 一节后，新增 `## quick start (SchemaForm / SchemaFields)`：两个示例（一行式 + 外部 form），说明 className 控制点四处、初值取 `meta.initialValues`、`Form.Item` 无 noStyle 校验可见、与 `useFormSchema` 的取舍。

- [ ] **Step 4: 全量验证**

Run: `pnpm test && pnpm build && pnpm --filter example build`
预期：全部测试 PASS；build 产出四文件；example 构建成功。
Run: `pnpm dev`，确认 dev server 启动无报错（不截图/dump-dom，按全局规则）；把地址给用户。

- [ ] **Step 5: Commit**

`git add packages/example packages/lib/README.md && git commit -m "feat: add quick-form demo and docs"`

---

### Task 4: 最终审查

**Files:** 无新增

- [ ] **Step 1: 全量验证**：`pnpm test` 全绿、`pnpm build`、`node -e` 验证 CJS/ESM named export 含 `SchemaForm`/`SchemaFields`。
- [ ] **Step 2: 验收核对**：对照 spec 的交付与验收逐项核对（一行出活、两个组件、className 生效、初值、校验可见、不动核心、demo 可访问）。若发现偏差，先记录再修复。
- [ ] **Step 3: Commit（如有修复）**：仅在有改动时 `git commit -m "fix: address acceptance gaps"`。
