# Descriptions 查看态实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `meta.viewMode: true` 时用 Ant Design `Descriptions` 渲染查看态，替换现有 `Form.Item + ViewSpan` 的单行布局。

**Architecture:** 数据层继续由 `useFormSchema` 生成 `viewContent`；渲染层新增 `SchemaView`，由 `SchemaFields` 在 `meta.viewMode` 为 true 时切换过去。`Descriptions` 只负责布局，字段值、option label、converter `read`、隐藏字段语义都不变。

**Tech Stack:** React 18, antd 5, TypeScript, vitest + @testing-library/react。

**Spec:** `docs/superpowers/specs/2026-11-21-descriptions-view-mode-design.md`

## Global Constraints

- 不改变编辑态行为；`viewMode` 关闭时输出保持现状。
- `meta.viewMode: true` 时，可见字段不再生成可见 `Form.Item`。
- `hidden` 字段仍然挂在 `Form.Item hidden`，提交值不能丢。
- 查看态值仍走 `readConvertedValue`；converter `write` 不执行。
- 字段级 `viewMode: true`（表单级关闭）仍保留旧只读 `Form.Item` 行为。
- 测试命令：`cd packages/lib && ./node_modules/.bin/vitest run`；不要用 `pnpm test`。
- 类型检查：`cd packages/lib && ./node_modules/.bin/tsc --noEmit -p tsconfig.json`。
- 代码注释和 commit message 用英文。

## Review Focus

1. **默认外观** — `column: 2`、`bordered: true`、`size: 'small'`，与详情页示例一致。
2. **字段内容** — 仍是 `field.viewContent`；`Descriptions.Item` 不依赖 `Form.Item` 注入 `initialValue`。
3. **优先级** — `meta.viewMode === true` 时强制所有字段进入查看态，字段级 `viewMode: false` 被忽略。
4. **隐藏字段** — 不进入 Descriptions，但仍渲染 hidden Form.Item。
5. **插槽/classNames** — `label`、`control` 继续生效；`field` 插槽在查看态忽略。
6. **校验** — `viewWidget` 未注册要报错；`viewSpan` 非正整数给 warning。

---

### Task 1: 类型与 hook

**Files:**
- Modify: `packages/lib/src/core/types.ts`
- Modify: `packages/lib/src/useFormSchema.ts`
- Test: `packages/lib/__tests__/17-descriptions-view.spec.tsx`

**Interfaces:**
- `ViewConfig`：`title` / `extra` / `column` / `bordered` / `size` / `layout` / `colon` / `className`。
- `FieldSchema` 新增 `viewSpan?: number`、`viewProps?: Record<string, any>`。
- `FormSchema` 新增 `view?: ViewConfig`。
- `BoundField` 新增 `viewSpan`、`viewProps`。
- `useFormSchema`：`const isView = meta.viewMode === true ? true : (field.viewMode ?? false);`
- 查看态控件 props 合并顺序：`widgetProps` → `viewProps` → `initialValue`。

- [ ] **Step 1: 写类型** — 在 `types.ts` 增加 `ViewConfig` 和字段属性。
- [ ] **Step 2: 改 hook** — 强制查看态、合并 `viewProps`、带出 `viewSpan` / `viewProps`。
- [ ] **Step 3: 写渲染测试** — 新建 `17-descriptions-view.spec.tsx`，覆盖 Descriptions 出现、字段级 false 被忽略、converter read。

---

### Task 2: SchemaView 组件

**Files:**
- Create: `packages/lib/src/components/SchemaView.tsx`
- Modify: `packages/lib/src/components/SchemaFields.tsx`
- Test: `packages/lib/__tests__/17-descriptions-view.spec.tsx`

**Interfaces:**
- `SchemaView` 接收 `fields`、`view`、`slots`、`classNames`。
- `SchemaFields` 在 `resolved.viewMode === true` 时返回 `SchemaView`，否则走原有 `Form.Item` 渲染。

- [ ] **Step 1: 写失败测试** — 渲染 `SchemaForm viewMode`，断言 `.ant-descriptions`、label、值、无可见 Form.Item。
- [ ] **Step 2: 实现 SchemaView** — 默认配置 + `viewSpan` + hidden Form.Item；复用 `renderSlot` / `renderLabel` / `renderControl`。
- [ ] **Step 3: 接 SchemaFields** — 增加 view 分支，`SchemaForm` 不需要改。
- [ ] **Step 4: 跑测试** — 新测试通过。

---

### Task 3: 校验与边界

**Files:**
- Modify: `packages/lib/src/core/validate.ts`
- Modify: `packages/lib/src/useFormSchema.ts`
- Test: `packages/lib/__tests__/17-descriptions-view.spec.tsx`

- [ ] **Step 1: 校验 viewWidget** — 字符串 id 未注册时报 `unregistered viewWidget`，dev 下 fatal。
- [ ] **Step 2: 校验 viewSpan** — 非正整数给 warning。
- [ ] **Step 3: 覆盖边界** — hidden 值仍可提交、condition 隐藏不出现、option label、custom viewWidget + viewProps。
- [ ] **Step 4: 全量测试** — `cd packages/lib && ./node_modules/.bin/vitest run` 全绿。

---

### Task 4: 示例与文档

**Files:**
- Modify: `packages/example/src/components/view-edit.tsx`
- Modify: `packages/example/src/components/detail-edit-demo.tsx`
- Modify: `README.md`

- [ ] **Step 1: view-edit** — 改成 `SchemaForm` + Descriptions；补充 `viewSpan`。
- [ ] **Step 2: detail-edit-demo** — 删除手写 `Descriptions`，查看态交给 schema；状态用自定义 `viewWidget`。
- [ ] **Step 3: README** — 增加查看态配置、`viewSpan`、`viewProps`、字段级覆盖说明。
- [ ] **Step 4: 构建验收** — lib tsup、example tsc/build 通过。

## 规模

约 250 行实现与测试、2 个示例文件、1 段 README；分 4 次提交，不 push。
