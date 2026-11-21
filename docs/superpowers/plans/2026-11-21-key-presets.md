# key 预设（label + widget）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `presets` 配置：一个文件按 key 定义 label（可多语言）与 widget；schema 只写 key，渲染自动套用，schema 显式值永远优先。

**Architecture:** 纯函数 `applyPresets(meta, presets, locale)` 在 `useFormSchema` 入口把预设合并进 `FormSchema`，之后沿用现有 `validate → normalize → bind` 管线。预设不生成字段、不接管 label/widget 之外的属性。

**Tech Stack:** React 18, antd 5, TypeScript, vitest + @testing-library/react。

**Spec:** `docs/superpowers/specs/2026-11-21-key-presets-design.md`

## Global Constraints

- 不传 `presets` 时行为必须与现在完全一致（现有 108 项测试全绿）。
- 预设只影响 `widget` 与 `label`，其余字段属性一律不动。
- `locale` 默认 `zh-CN`；缺语言/缺词静默回退 `zh-CN`，不 warn、不抛错。
- label 最终兜底是 key 原文（`field.key`，不是 name、不拆段）。
- schema 显式 `label` / `widget` 优先级最高。
- 结论：预设里有、schema 里没有的 key 忽略，不生成字段。
- 测试在 `packages/lib` 下跑：`pnpm test`。
- 代码注释与 commit message 用英文。

## Review Focus

1. **无预设零回归** — `applyPresets` 在 `presets === undefined` 时直接返回原 meta，现有测试不看 label 兜底。
2. **label 回退顺序** — `schema.label` → `labels[locale]` → `labels['zh-CN']` → 内置词典同序 → key；缺 en-US 不告警。
3. **widget 简写** — `fields: { title: 'input' }` 与 `{ title: { widget: 'input' } }` 等价。
4. **合并时机** — 必须在 `validateMeta` 之前，预设写错 widget id 能走既有校验。
5. **渲染层零改动** — label/widget 进入 `NormalizedField` 后，`SchemaFields` 不需要额外查表。

---

### Task 1: 预设核心（类型 + applyPresets + 内置词典）

**Files:**
- Modify: `packages/lib/src/core/types.ts`
- Create: `packages/lib/src/core/presets.ts`
- Create: `packages/lib/src/core/builtin-labels.ts`
- Test: `packages/lib/__tests__/11-key-presets.spec.ts`

**Interfaces:**
- Produces: `applyPresets(meta: FormSchema, presets?: Presets, locale?: string): FormSchema`。
- Produces types: `PresetField = string | { widget: Widget }`、`PresetsInput = { fields?; labels? }`、`Presets = PresetsInput | Record<string, string>`。

- [x] **Step 1: 写失败测试** — 覆盖 spec 测试 1/3/5/6/8/9/10 的纯函数部分：合并 widget、schema 覆盖、locale 回退、扁平表、完整 key 优先、无词兜底 key、无预设返回原对象。
- [x] **Step 2: 类型与内置词典** — `types.ts` 加三个类型与 `UseFormSchemaOptions.presets/locale`；`builtin-labels.ts` 导出 `BUILTIN_LABELS: Record<locale, Record<key, label>>`，zh-CN/en-US 各约 20 条。
- [x] **Step 3: 实现 applyPresets** — 形态判定（含 `fields`/`labels` 视为分段，否则整表按 zh-CN label 表）；key 查找完整优先、末段其次；不改入参。
- [x] **Step 4: 跑测试** — `cd packages/lib && pnpm vitest run __tests__/11-key-presets.spec.ts`。

---

### Task 2: 接入 hook 与组件 props

**Files:**
- Modify: `packages/lib/src/useFormSchema.ts`
- Modify: `packages/lib/src/components/SchemaFields.tsx`
- Modify: `packages/lib/src/components/SchemaForm.tsx`
- Modify: `packages/lib/src/index.tsx`
- Test: `packages/lib/__tests__/12-presets-render.spec.tsx`

**Interfaces:**
- `SchemaFieldsProps` / `SchemaFormProps` 新增 `presets?: Presets`、`locale?: string`；`SchemaForm` 不再把它们透传给 antd `<Form>`。

- [x] **Step 1: 写失败测试** — 渲染级：只写 key 出 label+widget、schema 覆盖、locale=en-US、只有中文表 + en-US 不告警（spy console.warn）。
- [x] **Step 2: hook 接入** — `useMemo(() => applyPresets(meta, presets, locale), [meta, presets, locale])`；`validateMeta` / `normalizeMeta` 都吃合并后的结果。
- [x] **Step 3: 组件透传** — `SchemaFields` 把 `presets/locale` 传给 hook；`SchemaForm` 解构 `presets/locale` 后单独传给 `SchemaFields`，`rest` 保持干净。
- [x] **Step 4: 导出** — `index.tsx` 已有 `export type * from './core/types'`，确认新类型可见。
- [x] **Step 5: 全量测试** — `cd packages/lib && pnpm test`，确认 108 项旧测试 + 新测试全绿。

---

### Task 3: 文档与示例

**Files:**
- Modify: `packages/lib/README.md`（或根 README，视现有内容归属）
- Modify: `packages/example` 的 schema demo（可选）

- [x] **Step 1: README 增加 Presets 段** — YAML 片段、Vite 读取方式、优先级说明、locale 缺省说明。
- [x] **Step 2: example 里接入一份 `presets.yaml`** — 至少 title/name/status 三个 key，验证真实构建路径（`@rollup/plugin-yaml`）。

## 规模

约 70 行实现 + 2 个测试文件；Task 1、2 完成后一次 `pnpm test` 验收。
