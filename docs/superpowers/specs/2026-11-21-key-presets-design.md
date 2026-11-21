# key 预设文件设计（label + widget）

日期：2026-11-21

## 意图

一个配置文件，管住「某个 key 长什么样」：它叫什么（label）、用哪个控件（widget）。schema 里只写 key，渲染时自动套用；schema 显式写了的以 schema 为准。label 支持多语言，但写法保持紧凑：widget 只写一次，文案按语言各一张扁平表，不在每个 key 里重复 locale。

## 用法（拍板形状）

```yaml
# presets.yaml
fields:                 # widget：一个 key 只写一次
  title: input          # 简写：字符串 = widget id
  status: select
  name: input

labels:                 # 文案：按语言一张扁平表
  zh-CN:
    title: 标题
    status: 状态
    name: 姓名
  en-US:
    title: Title
    status: Status
    name: Name
```

```tsx
import presets from './presets.yaml'; // Vite YAML 插件转成普通对象

<SchemaForm meta={meta} presets={presets} locale="zh-CN" />  // 或 "en-US"
```

```ts
// schema 只写 key
{ key: 'title' }   // → input + 标题
{ key: 'status' }  // → select + 状态
{ key: 'name' }    // → input + 姓名
```

单语言可以只写一层：

```yaml
# presets.yaml
title: 输入标题
name: 姓名
```

```tsx
<SchemaForm meta={meta} presets={presets} />
```

需要单独改某个字段时照旧写在 schema 上：

```ts
{ key: 'title', widget: 'textarea', label: '文章标题' }  // schema 覆盖预设
```

## 方案对比

- **A：组件渲染时查预设** — 合并逻辑散在 `SchemaFields`，`useFormSchema` 的产物不完整，别的消费方拿不到。
- **B：构建脚本回写 schema** — 源文件被生成物污染，测试、Node 场景难复用。
- **C：hook 入口合并（选定）** — `useFormSchema` 先 `applyPresets(meta, presets, { locale })`，再走原有 `validate → normalize → bind`。纯函数、可单测，渲染层零改动。

## 目标

- 预设只有两块：`fields`（key → widget）和 `labels`（locale → key → 文案）。
- `fields` 的值支持简写：`title: input` 等价 `{ widget: 'input' }`。
- 没有 `fields` / `labels` 段时，整个文件按「单语言 label 表」处理（`title: 标题`）。
- schema 永远优先：预设只填 schema 没写的 `widget` 和 `label`。
- `locale` 默认 `zh-CN`：**不传就是中文**，中文表直接生效，不需要显式声明。
- 当前语言缺词回退 `zh-CN`，再回退内置词典。
- **语言不要求齐全**：只写中文是默认用法；`labels` 里没有 `en-US`、或 en-US 缺某个 key，都属于正常情况，静默回退中文，不报错、不告警。中英都写的场景（如公司项目）同样只是多填一张表。
- **兜底用 key 本身**：中英都没写、内置词典也没有时，label 直接显示 key 原文，不再留白。
- 文件格式 YAML / JSON / TS 均可，构建期读成对象传入，库内不碰文件系统。

## 非目标 / 反目标

- **只支持 label 和 widget**：`widgetProps`、`options`、`placeholder`、`rules`、`required` 等仍写在 schema 上，预设不接管。
- **预设不生成字段**：只对 schema 里出现过的 key 生效；表里多出来的 key 忽略。
- 不做多语言完整性校验：缺语言、缺词、key 数量对不上都不报错，静默回退。
- 不做 options / placeholder / 校验文案的翻译。
- 不做运行时读取 / 远程拉取、多文件合并、预设继承。

## 优先级

- widget：`schema.widget` > `presets.fields[key].widget` > 内置默认 `input`
- label：`schema.label` > `presets.labels[locale][key]` > `presets.labels['zh-CN'][key]` > 内置词典[locale] > 内置词典['zh-CN'] > key 原文
- `schema.label` 永远最高：别人在 schema 里单独配了 label，就听那个的（含 ReactNode）
- key 查找：完整 key（`user.email`）优先，其次最后一段（`email`）

## 实现要点

- `src/core/types.ts`：
  ```ts
  export type PresetField = string | { widget: Widget };
  export interface PresetsInput {
    fields?: Record<string, PresetField>;
    labels?: Record<string, Record<string, string>>;
  }
  export type Presets = PresetsInput | Record<string, string>;
  ```
  `UseFormSchemaOptions` 增加 `presets?: Presets`、`locale?: string`。
- 新增 `src/core/presets.ts`：`applyPresets(meta, presets?, locale = 'zh-CN')`，返回新 `FormSchema`，不改入参。
  - 识别形态：根对象含 `fields` / `labels` → 分段形态；否则视为扁平 label 表。
  - 字段 `widget` 为空时套 `fields[key]`（字符串简写直接当 widget id）。
  - 字段 `label` 为空时按 locale 链查 `labels`，再查内置词典，最后兜底 `field.key`。
- 新增 `src/core/builtin-labels.ts`：一个文件导出 `{ 'zh-CN': {...}, 'en-US': {...} }`，常用键约 20 条（title / name / nickname / email / phone / status / remark / createdAt…）。
- `src/useFormSchema.ts`：入口改为 `applyPresets` 后再 `validateMeta` / `normalizeMeta`，`useMemo` 依赖补 `presets`、`locale`。这样预设里写错 widget id 能走既有 unregistered widget 校验。
- `SchemaForm.tsx` / `SchemaFields.tsx`：props 增加 `presets`、`locale`，透传给 hook；异步 meta 路径不变。
- `index.tsx`：导出 `PresetField`、`PresetsInput`、`Presets`。
- README / example：
  ```ts
  // vite.config.ts
  import yaml from '@rollup/plugin-yaml';
  export default { plugins: [yaml()] };
  ```
  ```ts
  import presets from './presets.yaml';
  <SchemaForm meta={meta} presets={presets} locale="zh-CN" />
  ```

## 测试

1. `{ key: 'title' }` + `fields.title: input` + `labels.zh-CN.title: 标题`，**不传 locale** → input 与标题。
2. 预设 `status: select` → 字段变 select。
3. schema 显式 `widget: 'textarea'` → 覆盖预设。
4. schema 显式 `label` → 覆盖预设 label（含 ReactNode）。
5. `locale="en-US"` 且有英文表 → 英文；en-US 缺该 key → 静默回退 zh-CN。
6. 只有 zh-CN 一张表 + `locale="en-US"` → 正常渲染中文，无 console 告警、不抛错。
7. 扁平单语言表（`title: 标题`）→ 直接生效，不依赖 locale。
8. 预设里有 schema 未使用的 key → 忽略，不生成字段。
9. 完整 key 与末段 key 并存（`user.email` / `email`）→ 完整 key 优先。
10. 中英字典和内置词典都没有该 key → label 显示 key 原文（如 `userEmail`），不留白。
11. 预设写了不存在的 widget id → 走既有 validate 告警/报错。
12. 不传 `presets` → 行为不变，现有 108 项测试全绿。

## 规模

小改动（新增 `presets.ts`、`builtin-labels.ts`，hook 与组件各几行，约 70 行实现，10 条测试）。直接走 writing-plans。
