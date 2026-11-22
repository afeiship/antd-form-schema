# 全局自定义 Widget 注册表实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers/subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 项目入口通过 `configureSchemaForm({ widgets })` 注册自定义组件，schema 以字符串 `widget` / `viewWidget` id 引用；注册表支持裸组件简写与定义对象两种形状；表单级 `widgets` 按 id 覆盖全局，内置表优先级最低；导出类型化的组件 props 契约。

**设计文档：** `docs/superpowers/specs/2026-11-22-global-widget-registry-design.md`

**提交约定：** 每个 Task（节点）结束独立一个 commit，conventional commits 格式；全部不 push。文档（spec + plan）作为首个 `docs` commit，之后按 Task 顺序提交。

---

## Task 1: 类型与注册表归一化

- [ ] **Step 1** — `core/types.ts`：
  - 新增 `export type WidgetInput = WidgetDef | ComponentType<any>`；
  - `SchemaFormDefaults` 增加 `widgets?: Record<string, WidgetInput>`；
  - `UseFormSchemaOptions.widgets` 类型放宽为 `Record<string, WidgetInput>`；
  - 新增导出 `WidgetComponentProps` 接口（`value` / `onChange` / `options` / `placeholder` / `disabled` / `readOnly` + 索引签名，见设计文档「自定义组件 props 契约」）。
- [ ] **Step 2** — `widgets/index.tsx`：
  - `normalizeWidgetDef(entry: WidgetInput): WidgetDef`：裸组件 → `{ component: entry }`；定义对象原样返回；
  - `mergeWidgets(global?, local?): Record<string, WidgetDef>`：两边逐项归一化后 `{ ...normalizedGlobal, ...normalizedLocal }`，本地覆盖全局。
- [ ] **Step 3** — 类型检查：`cd packages/lib && ./node_modules/.bin/tsc --noEmit -p tsconfig.json`。
- [ ] **Step 4** — Commit：

```bash
git add packages/lib/src/core/types.ts packages/lib/src/widgets/index.tsx
git commit -m "feat(lib): accept bare-component shorthand in widget registry"
```

## Task 2: 全局默认接入 hook 与透传类型

- [ ] **Step 1** — `core/defaults.ts`：`configureSchemaForm` 按字段浅合并 `widgets`（与 `converters` 同模式：未提供则保留原值）；确认 `getSchemaFormDefaults` 快照与 `resetSchemaFormDefaults` 覆盖 widgets 字段。
- [ ] **Step 2** — `useFormSchema.ts`：
  - 读取 `getSchemaFormDefaults().widgets`，与 `options?.widgets` 经 `mergeWidgets` 合并；
  - 合并表喂给 `validateMeta`（替换现有 `{ ...WIDGETS, ...widgets }` 拼装）；
  - `resolveWidget` 编辑态与查看态 `viewWidget` 均使用合并表。
- [ ] **Step 3** — `components/SchemaFields.tsx` / `components/SchemaForm.tsx`：`widgets` prop 类型放宽为 `Record<string, WidgetInput>`，透传逻辑不变。
- [ ] **Step 4** — 类型检查 + 现有测试回归：`./node_modules/.bin/tsc --noEmit -p tsconfig.json`；`./node_modules/.bin/vitest run`。
- [ ] **Step 5** — Commit：

```bash
git add packages/lib/src/core/defaults.ts packages/lib/src/useFormSchema.ts packages/lib/src/components/SchemaFields.tsx packages/lib/src/components/SchemaForm.tsx
git commit -m "feat(lib): resolve string widget ids from global and local registry"
```

## Task 3: 测试

- [ ] **Step 1** — 新增 `packages/lib/__tests__/18-global-widget-registry.spec.tsx`（import 风格对齐 `15-global-defaults.spec.tsx`）：
  1. 全局注册的裸组件被字符串 `widget` 引用并渲染，收到值绑定（`value` / `onChange`）与 `widgetProps`；
  2. 全局注册的定义对象携带 `metaConverter`，其 `valuePropName` / `widgetProps` 合并生效；
  3. 表单级 `widgets` 同名 id 覆盖全局；未覆盖的全局 id 仍可用；
  4. 未注册的字符串 id 在开发环境抛 `unregistered widget`（查看态 `unregistered viewWidget`）；直接传组件不触发字符串校验、不报错；
  5. 全局注册表解析查看态 `viewWidget` 字符串 id；
  6. `resetSchemaFormDefaults()` 清空全局注册表，reset 后未注册 id 照常报错；
  7. 简写与定义对象混在同一个注册表可共存。
- [ ] **Step 2** — 单 spec：`./node_modules/.bin/vitest run 18-global-widget-registry`，期望全绿；全量 `./node_modules/.bin/vitest run` 回归。若 `05-hook.spec.tsx` 快照了 hook 结果形状，做最小断言更新并在台账记录。
- [ ] **Step 3** — Commit：

```bash
git add packages/lib/__tests__/18-global-widget-registry.spec.tsx
git commit -m "test(lib): cover global widget registry, shorthand and precedence"
```

## Task 4: 文档与示例

- [ ] **Step 1** — `packages/example/src`：
  - 新增一个业务自定义组件（如评分 / 标签输入），props 按 `WidgetComponentProps` 契约接收；
  - `global-schema.ts` 在 `configureSchemaForm` 中注册 `widgets`（至少一个简写、一个定义对象）；
  - `app.tsx` 演示站接入新 demo，schema 用字符串 id 引用。
- [ ] **Step 2** — `README.md` 增加「自定义控件 / 全局注册表」小节：注册方式、两种形状、props 契约、覆盖优先级、查看态解析、reset 注意事项。
- [ ] **Step 3** — 构建与类型检查：`cd packages/lib && ./node_modules/.bin/tsup`；`cd packages/example && ../lib/node_modules/.bin/tsc --noEmit -p tsconfig.json`。
- [ ] **Step 4** — Commit：

```bash
git add packages/example/src README.md
git commit -m "docs(example): document global custom widget registry with demo"
```

## Task 5: 计划勾选与台账

- [ ] **Step 1** — 回填本计划全部复选框；在 `.superpowers/sdd/2026-11-22-global-widget-registry/` 写 `progress.md` 台账（各 Task 提交区间、测试命令与结果）。
- [ ] **Step 2** — Commit（docs only，不 push）：

```bash
git add docs/superpowers/plans/2026-11-22-global-widget-registry.md .superpowers/sdd/2026-11-22-global-widget-registry/
git commit -m "docs(plan): mark global widget registry complete"
```
