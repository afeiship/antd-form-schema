# Preset 字段对象化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers/subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** `presets.fields[key]` 支持对象形式，对象上的任意属性作为控件 props 默认值；字符串简写保持兼容，schema 显式配置始终优先。

**设计文档：** `docs/superpowers/specs/2026-11-21-preset-widget-props-design.md`

---

## Task 1: 类型

- [ ] **Step 1** — `core/types.ts` 新增 `PresetFieldObject`：
  - `widget: Widget`；
  - `widgetProps?: Record<string, any>`；
  - 任意额外键。
- [ ] **Step 2** — `PresetField` 扩展为 `string | PresetFieldObject`。
- [ ] **Step 3** — 类型检查：`cd packages/lib && ./node_modules/.bin/tsc --noEmit -p tsconfig.json`。

## Task 2: 合并逻辑

- [ ] **Step 1** — `core/presets.ts` 将 `widgetOf` 换成 `presetOf(entry)`，返回 `{ widget, props }`：
  - 字符串 → `{ widget: entry, props: {} }`；
  - 对象 → `widget` 保留，直接属性与 `widgetProps` 合并，`widgetProps` 优先。
- [ ] **Step 2** — 提取字段级属性，schema 优先：
  - `placeholder`：`field.placeholder ?? preset.props.placeholder`；
  - `disabled`：仅当 schema 字段和 `meta.disabled` 都未配置时采用预设值；
  - `readOnly`：`field.readOnly ?? preset.props.readOnly`；
  - `options`：`field.options ?? preset.props.options`。
- [ ] **Step 3** — 其余 props 合并进 `widgetProps`：
  - `{ ...presetRest, ...field.widgetProps }`；
  - 保证 schema 自己的 `widgetProps` 逐 key 覆盖预设。
- [ ] **Step 4** — widget 优先级保持 `field.widget ?? preset.widget ?? input`；schema 只覆盖 widget 时，预设其他 props 仍生效。
- [ ] **Step 5** — 不修改入参对象，返回值仍是新的 `FormSchema`。

## Task 3: 测试

- [ ] **Step 1** — 新增 `__tests__/16-preset-widget-props.spec.tsx`：
  - 字符串简写回归；
  - 对象 `placeholder`；
  - 布尔 / 数字 props 透传；
  - 对象 props（textarea `autoSize`）透传；
  - `widgetProps` 与直接属性重复时 `widgetProps` 优先。
- [ ] **Step 2** — 覆盖优先级：
  - schema `placeholder` 覆盖预设；
  - schema `widgetProps` 覆盖预设同名属性；
  - schema 覆盖 `widget` 时预设其他 props 仍生效；
  - schema `options` / `disabled` / `readOnly` 覆盖预设。
- [ ] **Step 3** — 自定义 widget 接收预设 props；未知 widget id 仍走校验。
- [ ] **Step 4** — 全量测试：`./node_modules/.bin/vitest run`。

## Task 4: 文档与示例

- [ ] **Step 1** — README presets 小节增加对象写法与优先级。
- [ ] **Step 2** — example 的 `presets.ts` 至少把 `title` / `bio` 改成对象形式，展示 `placeholder`、布尔属性、对象属性。
- [ ] **Step 3** — 类型检查：`./node_modules/.bin/tsup`；`cd ../example && ../lib/node_modules/.bin/tsc --noEmit -p tsconfig.json`。

## Task 5: 提交

- [ ] **Step 1** — 按模块提交：types + presets、tests、example、README、plan 勾选；全部不 push。
