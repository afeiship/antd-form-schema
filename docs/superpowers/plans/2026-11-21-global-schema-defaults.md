# SchemaForm 全局默认配置实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 增加项目级 `presets` / `converters` / `locale` 默认配置，三个入口共享，表单级 props 只负责覆盖。

**设计文档：** `docs/superpowers/specs/2026-11-21-global-schema-defaults-design.md`

---

## Task 1: 类型与全局配置核心

- [ ] **Step 1: 类型** — `core/types.ts` 增加 `SchemaFormDefaults`，包含 `presets?`、`converters?`、`locale?`。
- [ ] **Step 2: 全局状态** — 新增 `core/defaults.ts`：
  - `configureSchemaForm(defaults)` 按已提供的字段浅合并；
  - `getSchemaFormDefaults()` 返回浅拷贝；
  - `resetSchemaFormDefaults()` 清空。
- [ ] **Step 3: presets 合并** — 同一文件实现 `normalizePresets` / `mergePresets`：
  - 扁平 label 表按 `zh-CN` 处理；
  - `fields` 按 key 合并，表单级覆盖全局；
  - `labels` 按 locale 合并，表单级覆盖全局，保留其他语言。
- [ ] **Step 4: 导出** — `index.tsx` 增加三个函数和 `SchemaFormDefaults` 类型导出。
- [ ] **Step 5: 类型检查** — `cd packages/lib && ./node_modules/.bin/tsc --noEmit -p tsconfig.json`。

## Task 2: useFormSchema 接入

- [ ] **Step 1: 读取默认值** — 在 hook 内读取全局配置，与 `options` 合并：
  - presets：`mergePresets(global, local)`；
  - converters：`{ ...global, ...local }`；
  - locale：`local ?? global ?? 'zh-CN'`。
- [ ] **Step 2: 稳定引用** — 用 `useMemo` 缓存合并后的 presets / converters，避免每次 render 重建导致 schema 重算。
- [ ] **Step 3: 校验联动** — `validateMeta` 使用合并后的 converter 注册表，全局 converter 可被字段引用。
- [ ] **Step 4: 回归** — 无全局配置时行为与现状完全一致。

## Task 3: 测试

- [ ] **Step 1: 渲染测试** — 新增 `__tests__/15-global-defaults.spec.tsx`：
  - 不传 props，`SchemaForm` 使用全局 presets、converters、locale；
  - 表单级 locale 覆盖全局；
  - 表单级 presets 按 key 覆盖并保留全局其他 key；
  - 表单级 converters 按 id 覆盖并保留全局其他 id。
- [ ] **Step 2: headless** — `useFormSchema` 在无 options 时同样拿到全局默认值。
- [ ] **Step 3: 生命周期** — 连续 `configureSchemaForm` 按字段合并；`resetSchemaFormDefaults` 彻底恢复；`afterEach` 清理全局状态。
- [ ] **Step 4: 全量** — `cd packages/lib && ./node_modules/.bin/vitest run`。

## Task 4: 示例与 README

- [ ] **Step 1: 示例配置** — 新增 `packages/example/src/global-schema.ts`，定义项目级 presets / converters 并调用 `configureSchemaForm`。
- [ ] **Step 2: 示例组件** — 新增 `global-defaults-demo.tsx`，表单不传三项 props，直接使用全局配置。
- [ ] **Step 3: 注册 demo** — `app.tsx` 的 demos 增加 “Global Defaults”。
- [ ] **Step 4: README** — 增加 “project defaults” 小节，说明 API、合并顺序和 reset。
- [ ] **Step 5: 构建** — `cd packages/lib && ./node_modules/.bin/tsup`；`cd ../example && ../lib/node_modules/.bin/tsc --noEmit -p tsconfig.json`。

## Task 5: 收尾

- [ ] **Step 1** — 更新本计划勾选状态。
- [ ] **Step 2** — 按模块拆分 commit：core、hook、tests、example、README、plan；全部不 push。
