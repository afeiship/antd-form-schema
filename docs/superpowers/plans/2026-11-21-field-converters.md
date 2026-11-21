# 字段级 converters 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `converters` 注册表与字段 `converter: '<id>'`：把字段的存储值与控件值双向转换，可读整表 `values`，只写本字段。

**Architecture:** 纯函数层 `core/converters.ts` 负责解析 id、生成 `getValueProps` / `getValueFromEvent`；`useFormSchema` 在 widget 的 `applyConverter` 之后套业务 converter，再合并 `field.itemProps`。校验、组件透传、README、example 依次接入。不传 `converters` 时零回归。

**Tech Stack:** React 18, antd 5, TypeScript, vitest + @testing-library/react。

**Spec:** `docs/superpowers/specs/2026-11-21-field-converters-design.md`

## Global Constraints

- converter 协议固定为 `read`（存储值 → 控件值）与 `write`（控件值 → 存储值），两者都必须纯函数。
- converter 可读 `ctx.values`，但只能写回本字段；禁止调用 form API、禁止跨字段写入。
- 与 `valueType` 互斥：同时出现属开发期错误。
- 未知 converter id 在 dev 下抛错，风格与 `unregistered widget` 一致。
- `field.itemProps` 里显式的 `getValueProps` / `getValueFromEvent` 优先级最高。
- 不传 `converters` 时行为与现在完全一致（现有 128 项测试全绿）。
- 测试在 `packages/lib` 下用 `./node_modules/.bin/vitest run`（该机 pnpm 11 会触发依赖校验失败，不要用 `pnpm test`）。
- 代码注释与 commit message 用英文；文档与 README 说明可用中文。

## Review Focus

1. **零回归** — `resolveConverter` 未命中或未传注册表时，`itemProps` 原样返回。
2. **方向正确** — `read` 只在回显方向执行，`write` 只在控件变更时执行，不能互换。
3. **视图态** — `viewMode` 下同样经过 `read`；不能显示「分」或 JSON 原文。
4. **优先级** — converter 先于 `field.itemProps` 合并，显式逃生舱最后赢。
5. **事件提取** — `getValueFromEvent` 收到的是事件参数，先取 `target.value` / `target.checked` / 首参，再交给 `write`。
6. **错误不扩散** — converter 抛错时回退原值并 warn，表单不崩。

---

### Task 1: 类型与 converter 核心

**Files:**
- Modify: `packages/lib/src/core/types.ts`
- Create: `packages/lib/src/core/converters.ts`
- Test: `packages/lib/__tests__/13-converters.spec.ts`

**Interfaces:**
- `FieldConverter = { read?: (value, ctx) => any; write?: (value, ctx) => any }`
- `ConverterContext = { field: NormalizedField; values: Record<string, any>; meta: FormSchema }`
- `FieldSchema.converter?: string`、`UseFormSchemaOptions.converters?: Record<string, FieldConverter>`、`BoundField.converter?: string`
- `resolveConverter(id, registry): FieldConverter | undefined`
- `applyFieldConverter(field, itemProps, converter, ctx, viewMode): FormItemProps`
- `runConverter(fn, value, ctx, direction): any`（内部 try/catch）

- [ ] **Step 1: 类型** — 在 `types.ts` 增加上述类型与字段，`BoundField` 增加 `converter` 便于调试。
- [ ] **Step 2: 写失败测试** — 覆盖 `resolveConverter` 命中/未命中；`read` 回显换算、`write` 写回；`null` 透传；`target.value` / `target.checked` 提取；抛错回退原值并 warn。
- [ ] **Step 3: 实现 core/converters.ts** — 生成/合并 `getValueProps` 与 `getValueFromEvent`；未命中时返回原 `itemProps`；`viewMode` 下只处理 `read`。
- [ ] **Step 4: 单测通过** — `cd packages/lib && ./node_modules/.bin/vitest run __tests__/13-converters.spec.ts`。

---

### Task 2: hook 接入、组件透传、校验

**Files:**
- Modify: `packages/lib/src/useFormSchema.ts`
- Modify: `packages/lib/src/components/SchemaFields.tsx`
- Modify: `packages/lib/src/components/SchemaForm.tsx`
- Modify: `packages/lib/src/core/validate.ts`
- Modify: `packages/lib/src/index.tsx`
- Test: `packages/lib/__tests__/14-converters-render.spec.tsx`

**Interfaces:**
- `SchemaFieldsProps` / `SchemaFormProps` 新增 `converters?: Record<string, FieldConverter>`，并从 `rest` 中解构掉。
- `validateMeta(meta, widgets?, converters?)`：未知 id 报 error；`converter + valueType` 报 error。

- [ ] **Step 1: 写失败测试** — 渲染级：money 初始 1999 显示 19.99；输入 20.5 提交后为 2050；`viewMode` 显示 19.99；`itemProps.getValueProps` 覆盖 converter；`converter + valueType` 触发错误。
- [ ] **Step 2: hook 接入** — `resolveConverter(field.converter, options?.converters)`；`applyFieldConverter` 在 `getItemProps` 之后、`converted.itemProps` 之前；视图态 `initialValue` 先过 `read`。
- [ ] **Step 3: 组件透传** — `SchemaForm` 解构 `converters` 后传给 `SchemaFields`；`SchemaFields` 传给 hook。
- [ ] **Step 4: 校验** — `validateMeta` 增加 converters 参数与两条规则；hook 把 `options?.converters` 传入。
- [ ] **Step 5: 导出** — `FieldConverter`、`ConverterContext` 通过 `export type *` 可见，确认 `index.tsx` 无需新增显式导出。
- [ ] **Step 6: 全量回归** — `cd packages/lib && ./node_modules/.bin/vitest run`，确认既有 128 项 + 新增全绿；`./node_modules/.bin/tsc --noEmit -p tsconfig.json`。

---

### Task 3: 文档与示例

**Files:**
- Modify: `packages/lib/README.md`
- Create: `packages/example/src/components/converters-demo.tsx`
- Modify: `packages/example/src/app.tsx`
- Modify: `docs/superpowers/plans/2026-11-21-field-converters.md`（勾选完成项）

- [ ] **Step 1: README** — 增加 `converters` 段：注册表、schema 只写 id、`read` / `write` 方向、只读 `values` 边界、与 `valueType` 互斥、`itemProps` 优先。
- [ ] **Step 2: example** — 新 demo 用 `money` / `percent` / `json` 三个 converter，展示初始回显与提交值；`app.tsx` 增加导航项。
- [ ] **Step 3: 构建与类型检查** — `cd packages/example && ../lib/node_modules/.bin/tsc --noEmit -p tsconfig.json`。
- [ ] **Step 4: 提交** — 分两次提交：`feat(lib): per-field converters` 与 `feat(example): add converters demo`；不 push。

## 规模

约 120 行核心实现 + 2 个测试文件（12–15 条）+ README/example；不动 widget 层、condition、presets。
