# antd-form-schema 最终需求（PRD v1.0）

> 状态：**FINAL / 定稿**（本文是本项目的唯一需求基线，早前的探讨性文档一律以本文为准）
> 日期：2026-11-19
> npm 包：`@jswork/antd-form-schema`
> 仓库：`afeiship/antd-form-schema`
> 一句话定位：**A tiny headless schema renderer for Ant Design form fields and rules.**

---

## 0. 摘要（TL;DR）

**Schema 只描述「字段是什么」——控件标识、数据、文案、校验、条件；绝不描述「长什么样」——布局、栅格、样式。**
库提供 headless hook，把 Schema 转成「antd 绑定 props + 默认控件 + 可见性」；DOM、Tailwind、栅格、分组全部由使用者的 JSX 决定。

```
Schema（纯数据）
   └─ useFormSchema(meta, form)  →  BoundField[]（数据 + itemProps + control + visible）
                                        └─ 你的 div + Tailwind 自由渲染
```

```tsx
const meta: FormSchema = {
  fields: [
    { key: 'name', label: '姓名', widget: 'input', required: true },
    { key: 'role', label: '角色', widget: 'select', options: ['admin', 'user'] },
    { key: 'company', label: '公司', widget: 'input',
      condition: { field: 'role', op: 'eq', value: 'admin' } },
  ],
};

function UserForm() {
  const [form] = Form.useForm();
  const { visibleFields } = useFormSchema(meta, form);
  return (
    <Form form={form} layout="vertical">
      <div className="grid grid-cols-2 gap-4">
        {visibleFields.map(f => (
          <div key={f.key}>
            <label className="text-sm font-medium">{f.label}</label>
            <Form.Item {...f.itemProps} noStyle>{f.control}</Form.Item>
          </div>
        ))}
      </div>
    </Form>
  );
}
```

---

## 1. 已确定的设计决策

这些是逐步讨论后**拍板**的结论，实现时不得再动摇。

| 编号 | 决策 | 结论 | 理由 |
| --- | --- | --- | --- |
| DER-001 | 目标 UI 库 | **只支持 Ant Design**，直接 `import` antd | 不做跨库通用，砍掉 Adapter 这层间接成本 |
| DER-002 | Adapter 抽象 | **完全没有** Adapter / 工厂 / 全局注册 / 单例 | 只有一个实现，接口与工厂是纯粹的过度设计 |
| DER-003 | Schema 的 UI 配置 | **零布局 / 零样式键**；Schema 是纯数据契约 | 配置式 UI 永远追不上代码（Tailwind）的表现力 |
| DER-004 | 呈现层 | 交还使用者的 `div` + Tailwind；库只出数据绑定 | 响应式 / 嵌套 / 条件样式用 class 一行搞定 |
| DER-005 | 控件标识 | **保留 `widget`**（竞品写法：字符串 id + React 组件双形态） | 直观、可序列化、贴合适配器由使用者自己写的场景 |
| DER-006 | 条件与联动 | 声明式 `condition` 为主 + 自动 `Form.useWatch`，函数作逃生舱 | 免去手写 `useUpdateOnChange`，meta 可序列化 |

> 已从方案中被明确否决的形态（不要回退）：语义 `type: 'string'|'enum'` 隐式映射、antd `Row`/`Col` 栅格渲染、配置式 `columns`/`gutter`/`colSpan`。

---

## 2. 目标与非目标

### 2.1 目标

1. 一份声明式 Schema 驱动 antd 表单字段的生成、绑定、校验与显隐。
2. **Headless**：库只产出数据与绑定能力，不产出布局 DOM。
3. 强类型：Schema、条件、BoundField 全程 TypeScript，`rules` 等复用 antd 官方类型。
4. 声明式条件可 JSON 序列化，可被后端下发 / 持久化。
5. 极高的呈现自由度：同一 Schema 可渲染成 grid、卡片、折叠面板、分步表单。
6. 零全局状态、零副作用注册，可安全多实例共存。
7. 体积小、依赖少（antd / react 为 peerDependency）。

### 2.2 非目标（明确不做）

- 不做跨 UI 库适配（MUI / 原生 HTML / 竞品 Adapter 机制）。
- 不做布局引擎、栅格系统、响应式配置键。
- 不做主题 / 样式系统（无内置 CSS 设计，`style.css` 仅保留脚手架兼容位）。
- 不接管状态管理与提交流程（`Form` 实例由使用者创建并持有）。
- 不做可视化表单设计器（Schema 由代码或后端产生）。
- 不重复实现 antd 已有的能力（`dependencies`/`shouldUpdate`/校验器直接透传）。

---

## 3. 架构：三层职责

```
┌────────────────────────────────────────────────────────────┐
│ ① Schema 层（纯数据契约，零布局 / 零样式）                   │
│    FormSchema { fields: [{ key, name, widget, label,        │
│                  options, rules, condition, initialValue }] }│
│    widget = 'select' | 'date-picker' | React 组件            │
└────────────────────────┬───────────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────────┐
│ ② Headless 核心（库的职责到此为止）                          │
│    · normalizeMeta / applyRules       纯函数                │
│    · validateMeta / collectWatchPaths 纯函数                │
│    · evaluateCondition                纯函数                │
│    · WIDGETS 表 + resolveWidget + metaConverter             │
│    · useFormSchema(meta, form, options) ← 唯一碰 hook 的入口  │
│      内部：Form.useWatch → 条件求值 → 构造 BoundField         │
└────────────────────────┬───────────────────────────────────┘
                         │ 输出：BoundField[]（数据 + 绑定 + 默认控件）
┌────────────────────────▼───────────────────────────────────┐
│ ③ 使用者的渲染层（100% 自由，库不介入）                       │
│    <div className="grid grid-cols-2 gap-4">                 │
│      <Form.Item {...f.itemProps}>{f.control}</Form.Item>    │
│    </div>                                                  │
└────────────────────────────────────────────────────────────┘
```

**铁律**：`WIDGETS` 只负责「widget id → 控件组件 + 控件 props / Form.Item props」，**绝不产出 DOM、栅格或样式**。库的边界停在第 ② 层。

---

## 4. Schema 规格（数据契约）

### 4.1 类型定义

```ts
// src/types.ts
import type { ReactNode, ComponentType } from 'react';
import type { FormItemProps, FormInstance, Rule } from 'antd';
import type { NamePath } from 'antd/es/form/interface';

export type { NamePath, FormInstance, FormItemProps, Rule };

/** widget：字符串 id（查 WIDGETS / widgets prop）或直接给组件（逃生舱） */
export type Widget = string | ComponentType<any>;

/** options 三种形态：字符串 / [value,label] 二元组 / 对象 */
export type OptionInput =
  | string
  | [any, ReactNode]
  | { value: any; label?: ReactNode; disabled?: boolean; key?: any };

export interface NormalizedOption {
  value: any;
  label?: ReactNode;
  disabled?: boolean;
  key?: any;
}

/** 字段契约：无任何布局 / 样式键 */
export interface FieldSchema {
  /** 唯一标识；未写 name 时按 '.' 拆成 NamePath */
  key: string;
  /** 数据路径；覆盖 key 推导。字段名本身含点号时用 '!!!' 前缀 */
  name?: NamePath;
  /** 控件标识，默认 'input' */
  widget?: Widget;
  /** 查看态控件，默认 'span'（只读文本） */
  viewWidget?: Widget;
  /** 传给控件的 props（如 { mode: 'multiple' }） */
  widgetProps?: Record<string, any>;
  label?: ReactNode;
  placeholder?: string;
  options?: OptionInput[];
  /** 必填快捷写法，normalize 时转成 required rule */
  required?: boolean;
  /** antd 原生校验规则，原样透传 Form.Item */
  rules?: Rule[];
  /** 声明式条件（推荐）或函数（逃生舱） */
  condition?: Condition | ConditionFn;
  initialValue?: any;
  disabled?: boolean;
  readOnly?: boolean;
  /** 查看模式：字段级覆盖表单级 */
  viewMode?: boolean;
  /** 函数型 condition 依赖路径声明（自动订阅用） */
  watch?: NamePath[];
  /** antd 原生细粒度联动，原样透传（首期可留空） */
  dependencies?: NamePath[];
  shouldUpdate?: FormItemProps['shouldUpdate'];
  valuePropName?: string;
}

/** 表单契约：同样无任何布局 / 样式键 */
export interface FormSchema {
  name?: string;
  version?: string;
  viewMode?: boolean;
  disabled?: boolean;
  initialValues?: Record<string, any>;
  fields: FieldSchema[];
}

/** 声明式条件 */
export type CompareOp =
  | 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'in' | 'nin' | 'empty' | 'notEmpty' | 'includes';
export interface CompareCondition { field: NamePath; op: CompareOp; value?: any; }
export interface LogicCondition { and?: Condition[]; or?: Condition[]; not?: Condition; }
export type Condition = CompareCondition | LogicCondition;
export type ConditionFn = (ctx: { form: FormInstance; values: Record<string, any> }) => boolean;
```

### 4.2 options 三形态

```ts
options: ['Apple', 'Orange'];                             // 字符串 → value=label
options: [['apple', '苹果'], ['orange', '橙子']];          // [value,label] 二元组
options: [{ value: 'apple', label: '苹果', disabled: true }]; // 对象（完整控制）
```

统一经 `normalizeOptions()` 归一为 `NormalizedOption[]`，由 widget 的 `metaConverter` 转成具体控件 children。

### 4.3 key / name 与 `!!!` 约定

- 未写 `name` 时：`key: 'user.name'` → `name: ['user','name']`（按 `.` 拆分）。
- 字段名本身含点号（如 `a.b` 是一个完整字段）：用 `key: '!!!a.b'` 强制不拆分。
- 显式 `name` 永远优先于 `key` 推导。

### 4.4 完整 Schema 示例

```ts
const meta: FormSchema = {
  name: 'user-form',
  initialValues: { role: 'user' },
  fields: [
    { key: 'name', label: '姓名', widget: 'input', required: true, placeholder: '请输入姓名' },
    { key: 'email', label: '邮箱', widget: 'input',
      rules: [{ type: 'email', message: '邮箱格式不正确' }] }, // rules.type 是 antd Rule 字段
    { key: 'age', label: '年龄', widget: 'number' },
    { key: 'bio', label: '个人简介', widget: 'textarea' },
    { key: 'role', label: '角色', widget: 'select', options: [
      { value: 'admin', label: '管理员' },
      { value: 'user', label: '普通用户' },
    ] },
    { key: 'company', label: '公司', widget: 'input',
      condition: { field: 'role', op: 'eq', value: 'admin' } },
    { key: 'skills', label: '技能', widget: 'select',
      widgetProps: { mode: 'multiple' }, options: ['React', 'Node', 'Go'] },
    { key: 'birthday', label: '生日', widget: 'date-picker' },
    { key: 'notify', label: '接收通知', widget: 'switch' },
    { key: 'agree', label: '同意协议', widget: 'checkbox', required: true },
  ],
};
```

这份 Schema 没有一个字提到布局或样式，但可以被渲染成横排、竖排、卡片、折叠面板中的任意一种。

---

## 5. API 规格

### 5.1 `useFormSchema`（主入口，named export）

```ts
interface WidgetDef {
  component: ComponentType<any>;
  /** 把 field 转成控件 props / Form.Item props（竞品实证的好设计） */
  metaConverter?: (ctx: { field: FieldSchema; meta: FormSchema }) => Partial<FieldSchema>;
}

interface UseFormSchemaOptions {
  /** 局部 widget 注册/覆盖：id → 定义，优先于内置 WIDGETS */
  widgets?: Record<string, WidgetDef>;
  /** meta 校验开关，默认开发环境开启 */
  validate?: boolean;
}

function useFormSchema(
  meta: FormSchema,
  form: FormInstance,
  options?: UseFormSchemaOptions,
): UseFormSchemaResult;

interface UseFormSchemaResult {
  fields: BoundField[];         // 全部字段（含 visible=false）
  visibleFields: BoundField[];  // 仅 visible=true（常用）
  getField(key: string): BoundField | undefined;
  issues: Issue[];              // validateMeta 结果，供测试 / 自定义 UI
}
```

### 5.2 `BoundField`（hook 产出的每个字段）

```ts
interface BoundField {
  // 来自 Schema 的语义数据（原样带出，供使用者渲染 label 等）
  key: string;
  name: NamePath;
  widget: string | Widget;
  label?: ReactNode;
  placeholder?: string;
  options?: NormalizedOption[];
  required?: boolean;
  viewMode: boolean;
  disabled?: boolean;
  /** 条件求值结果：false 表示不应渲染 */
  visible: boolean;

  // antd 数据绑定（展开即用，无任何样式键）
  itemProps: FormItemProps;   // { name, rules, valuePropName, dependencies ... }

  // 控件（渲染关注点）
  control: ReactNode;                    // 默认控件元素，直接放进 Form.Item
  controlProps: Record<string, any>;     // { options, placeholder, disabled ... } 供自造控件
  WidgetComponent?: ComponentType<any>;  // 默认控件组件本身

  // 查看态
  viewContent?: ReactNode;       // viewMode 下的只读展示内容
}
```

`itemProps` 只含数据绑定键：`name` / `rules` / `valuePropName` / `dependencies` / `shouldUpdate`。
**刻意不含 `label`**（文案已由 `f.label` 带出，排版归使用者的 JSX）、不含任何 `className`/`style`/`labelCol`/`wrapperCol`。

> `valuePropName` 不硬编码，由 widget 的 `metaConverter` 写入：`checkbox`/`switch` → `'checked'`，其余用 antd 默认 `'value'`。扩展新 widget 无需改库。

### 5.3 `FormFields` 与默认导出（便捷渲染器，非主体）

为 demo / 简单后台提供零心智负担的默认渲染，只是「一种用法」，不是库的边界：

```tsx
import AntdFormSchema, { FormFields } from '@jswork/antd-form-schema';

<Form form={form}>
  <FormFields fields={visibleFields} className="space-y-4" />
  {/* 默认导出 AntdFormSchema 即 FormFields 的别名，兼容脚手架现状 */}
</Form>
```

- 内部只是纵向 `div` + `Form.Item` + `f.control` 的薄封装，随时可删掉改用自定义 JSX。
- **不提供 `columns`/`gutter` 等布局 props**——需要布局就该写 JSX。
- 保留 `style.css` 导出位仅为兼容脚手架，headless 设计下默认几乎为空。

### 5.4 `validateMeta`（named export）

| 检查 | 级别 | 行为 |
| --- | --- | --- |
| `fields` 非数组 | error | 明确报错 |
| 字段 `key` 缺失 / 重复 | error | 含索引 |
| `widget` 字符串既不在内置表也不在 `widgets` prop | error | 开发期阻断，生产期降级为 `input` |
| `condition.field` 指向不存在字段 | warning | 可能永远不触发 |
| `options` 非数组 | error | — |
| `rules` 非法 | warning | — |

`useFormSchema` 开发期自动跑校验并 `console.warn`，同时把 `issues` 作为返回值暴露。

---

## 6. Widget 系统

### 6.1 内置 WIDGETS 表（沿用竞品 widget id）

| widget id | 默认 antd 控件 | metaConverter 要点 |
| --- | --- | --- |
| `input` / `text` | `Input` | `text` 为别名 |
| `password` | `Input.Password` | — |
| `textarea` | `Input.TextArea` | — |
| `number` | `InputNumber` | — |
| `date-picker` | `DatePicker` | — |
| `date-time` | `DatePicker` | 别名 + `showTime: true` |
| `radio` | `Radio` | — |
| `radio-group` | `Radio.Group` | `options` → `<Radio>` children |
| `checkbox` | `Checkbox` | 写 `valuePropName: 'checked'` |
| `switch` | `Switch` | 写 `valuePropName: 'checked'` |
| `checkbox-group` | `Checkbox.Group` | `options` → `<Checkbox>` children |
| `select` | `Select` | `options` → `<Select.Option>` |
| `span`（查看态默认） | `span` | 只读文本，enum 显示 label |
| `form-list` | `Form.List` | 递归子项 + 增删（后期，首期可不做） |

> `date-time` 是竞品源码里才有的别名，显式纳入。`viewWidget` 缺省为 `span`，可用字段级 `viewWidget` 覆盖。

### 6.2 三种覆盖方式（灵活度递增）

```tsx
// 1) 用默认控件
<Form.Item {...f.itemProps}>{f.control}</Form.Item>

// 2) 用 controlProps 自造控件（复用归一化的 options/placeholder）
<Form.Item {...f.itemProps}>
  <MySelect options={f.controlProps.options} />
</Form.Item>

// 3) 传给 hook 局部注册/覆盖 widget id（不改 schema，零全局状态）
const { fields } = useFormSchema(meta, form, {
  widgets: {
    'radio-button': { component: RadioButtonGroup }, // 新增 id
    select: { component: MySelect },                  // 覆盖内置 select
  },
});
// 之后 schema 里写 widget: 'radio-button' 即可
```

### 6.3 直接给组件（逃生舱）

```ts
{ key: 'rating', label: '评分', widget: Rate, initialValue: 3 }
```

`resolveWidget` 遇到非字符串 `widget` 直接当组件使用，不经映射表。

---

## 7. 条件与联动

### 7.1 声明式条件（可序列化）

```ts
condition: { field: 'role', op: 'eq', value: 'admin' }

condition: { or: [
  { field: 'customerType', op: 'eq', value: '个人' },
  { and: [
    { field: 'customerType', op: 'eq', value: '企业' },
    { field: 'scale', op: 'gte', value: 100 },
  ] },
] }
```

比较符：`eq/ne/gt/gte/lt/lte/in/nin/empty/notEmpty/includes`，递归支持 `and/or/not`。

### 7.2 自动订阅，无需手写 onValuesChange

```
collectWatchPaths(fields) → Form.useWatch(paths, form)
  → 任一被监听字段变化 → 重渲染 → evaluateCondition 读最新值
```

- 声明式条件的依赖路径**自动收集**；
- 函数型 `condition` 无法自动收集，用 `watch: NamePath[]` 显式声明依赖（逃生舱）；
- 竞品的 `useUpdateOnChange(fields)` 不再需要。
- `useWatch` 返回值只用于触发重渲染，实际取值统一走 `form.getFieldValue()`，避免闭包旧值。

### 7.3 antd 原生联动透传

字段上的 `dependencies` / `shouldUpdate` 作为原生键原样进入 `itemProps`，交给 antd 处理；库不重造联动机制。

### 7.4 隐藏 vs 卸载（交给渲染层）

- **卸载**：用 `visibleFields`（DOM 移除，antd `Form.Item` 默认 `preserve=true` 保留值）；
- **隐藏但保留值**：使用者自己给外层 `div` 加 `hidden` class 或条件渲染——库不需要 `hideWhen` 之类的键。

---

## 8. 查看 / 编辑模式

- 表单级 `meta.viewMode` 或字段级 `field.viewMode` 切换；
- 查看态：`itemProps.valuePropName = 'initialValue'`（antd 只读展示 trick）；
- `f.viewContent` 提供默认只读文本（由 `viewWidget` 决定，enum 显示 label），使用者也可完全自定义；
- 一份 Schema 支持编辑 / 查看两种呈现。

---

## 9. 明确排除的 UI 配置（不要回退）

| 被排除的键（竞品 / 前版） | 归属到哪 |
| --- | --- |
| `columns` / `gutter` / `colSpan` / `clear` / `fullWidth` / `colProps` | 使用者的 `div` + Tailwind grid / flex |
| `labelWidth` / `labelCol` / `wrapperCol` / `layout` | 使用者的 Tailwind + antd `Form` props |
| `className` / `style`（字段级） | 使用者的 `className` |
| `wrapperProps` | 使用者直接写在自己的 `Form.Item` 上 |
| `hideWhen` | 使用者的 CSS `hidden` / 条件渲染 |

> 判断标准：**「换一套设计系统 / Tailwind 主题后还要不要改？」** 要改 = UI（移出 Schema）；不改 = 数据契约与控件标识（留下）。`widget: 'select'` 换主题还是 `'select'`，留下；`colSpan: 2` 换布局就没意义，移除。

---

## 10. 使用示例

### 10.1 两列 Tailwind grid（最常用）

```tsx
function UserForm() {
  const [form] = Form.useForm();
  const { visibleFields } = useFormSchema(meta, form);
  return (
    <Form form={form} onFinish={console.log} layout="vertical">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleFields.map(f => (
          <div key={f.key} className={f.widget === 'textarea' ? 'md:col-span-2' : ''}>
            <label className="block mb-1 text-sm font-medium text-gray-700">
              {f.label}{f.required && <span className="text-red-500"> *</span>}
            </label>
            <Form.Item {...f.itemProps} noStyle>{f.control}</Form.Item>
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button htmlType="reset">重置</Button>
        <Button type="primary" htmlType="submit">提交</Button>
      </div>
    </Form>
  );
}
```

- 布局是 Tailwind 原生响应式，库里没有任何 `columns` 配置；
- `textarea` 跨两列是一个 class 判断，不需要 `colSpan`；
- label 星号、字号、颜色全在 JSX，不需要 `labelWidth`。

### 10.2 分组折叠（配置式几乎做不到）

```tsx
const groups = [
  { title: '基本信息', keys: ['name', 'email', 'age'] },
  { title: '扩展信息', keys: ['bio', 'role', 'company'] },
];

<Form form={form} layout="vertical">
  <div className="space-y-6">
    {groups.map(g => (
      <details key={g.title} className="border rounded-lg p-4">
        <summary className="font-semibold cursor-pointer">{g.title}</summary>
        <div className="grid grid-cols-2 gap-4 mt-4">
          {g.keys.map(k => {
            const f = getField(k);
            return f?.visible ? (
              <Form.Item key={k} {...f.itemProps} label={f.label}>{f.control}</Form.Item>
            ) : null;
          })}
        </div>
      </details>
    ))}
  </div>
</Form>
```

纯 `div` + `<details>` + Tailwind 实现分组折叠——Schema 里不需要也不应该有 `collapsible: true`。

### 10.3 完全自定义控件

```tsx
{visibleFields.map(f => (
  <Form.Item key={f.key} {...f.itemProps} label={f.label}>
    {f.widget === 'select'
      ? <Radio.Group options={f.controlProps.options} optionType="button" buttonStyle="solid" />
      : f.control}
  </Form.Item>
))}
```

把 `select` 从默认 Select 换成按钮式 Radio.Group——只改一处 JSX，Schema 不动。

---

## 11. 技术要求（对齐本仓库现状）

| 项 | 本仓库现状 / 要求 |
| --- | --- |
| npm 包名 | `@jswork/antd-form-schema`（遵循 `@jswork` scope） |
| 仓库结构 | pnpm workspace：`packages/lib`（主库）+ `packages/example`（Vite demo） |
| 主库源码 | `packages/lib/src/index.tsx` 作为入口，按第 13 节拆分模块 |
| 构建 | `tsup` → `dist/index.mjs`（ESM）、`index.cjs`（CJS）、`index.d.ts`、`style.css` |
| 测试 | `vitest` + `@testing-library/react`（现行 `__tests__/01-basic.spec.tsx`） |
| React | 18+，peerDependency（现有） |
| **antd** | **新增 peerDependency `antd >= 5`**（当前缺失，必须补） |
| classnames | 保留（现有 peerDependency，用于便捷组件 className 合并） |
| 导出形态 | named：`useFormSchema` / `FormFields` / `validateMeta` / 类型；default：`AntdFormSchema`（= `FormFields` 别名，兼容脚手架） |
| 体积 | 保持「tiny」定位，核心纯函数无 antd 运行时依赖（antd 仅在控件映射层 import） |

> 当前 `lib/src/index.tsx` 是一个空壳 div 组件，需按本文重写为 headless hook 为主 API，并保留默认导出兼容。

---

## 12. 实现阶段与验收标准

```
packages/lib/src/
├── index.tsx          # 导出 useFormSchema / FormFields / validateMeta / 类型 + 默认导出
├── types.ts           # FormSchema / FieldSchema / BoundField / Condition / WidgetDef
├── useFormSchema.ts   # 唯一 hook：编排纯函数 + useWatch + 构造 BoundField
├── normalize.ts       # normalizeMeta（key→name / options / required→rules / 初始值）
├── condition.ts       # evaluateCondition / collectWatchPaths
├── widgets.tsx        # 内置 WIDGETS 表 + resolveWidget + metaConverter
├── bind.ts            # getItemProps / getControlProps（只产数据绑定 props）
├── validate.ts        # validateMeta
├── FormFields.tsx     # 可选便捷渲染器（薄）
└── utils.ts           # get / has / uniqPaths / normalizeOptions
```

| 阶段 | 内容 | 退出标准（验收） |
| --- | --- | --- |
| 1 | 类型 + `normalize`/`condition`/`bind`/`validate` 纯函数 | 单测覆盖 `!!!`、options 三形态、required→rules、条件求值 |
| 2 | `widgets.tsx` 内置映射 | 6.1 表里的 widget 都能产出默认控件与 metaConverter（`checked`/options children） |
| 3 | `useFormSchema` hook + 自动 `useWatch` | 改 `role` 触发 `company` 显隐，无需 `onValuesChange` |
| 4 | 查看/编辑模式 + `viewContent` | 一份 Schema 切两种模式，enum 显示 label |
| 5 | `FormFields` + 默认导出 | 简单场景零配置出活；无布局 props |
| 6 | `packages/example` 示例站 | Basic Grid / Card Groups / Custom Widget / View-Edit / Conditional / 分步表单 |

**总体验收**：用本库替换一个真实业务表单，布局/样式 100% 由 div + Tailwind 完成，Schema 中无任何布局键。

---

## 13. 与竞品对照

| 能力 | 竞品 nice-form-react | 本方案 |
| --- | --- | --- |
| Schema 含 UI 配置 | 是（columns/gutter/colSpan…） | **否，纯数据契约** |
| 控件标识 | `widget: string \| Component` | **同（沿用竞品）** |
| 布局方式 | CSS grid 自算 / Row+Col | **使用者的 div + Tailwind** |
| 样式定制 | 有限 + `render` 逃生舱 | **无限制（就写 CSS）** |
| 中间层 | Adapter + 全局 config | **无** |
| 显隐 | 函数 + 手写 `useUpdateOnChange` | 声明式 + 自动 `useWatch` + 渲染层 filter |
| 控件映射 | Adapter widgetMap（全局） | 内置 WIDGETS + 局部 `widgets` prop，仅产控件不产 DOM |
| 布局语义演进 | 加配置键、发版 | **改自己的 className** |
| meta 可序列化 | 否（函数） | **是**（函数为可选逃生舱） |
| 库的职责边界 | 数据+布局+样式+绑定 | **仅数据+绑定** |

---

## 14. 术语表

| 术语 | 含义 |
| --- | --- |
| Schema / meta | 描述字段的纯数据对象（`FormSchema`），可序列化 |
| Headless | 库只提供数据与逻辑能力，不产出 DOM / 样式 |
| widget | 控件标识：字符串 id（查表）或 React 组件（逃生舱） |
| BoundField | hook 输出的单个字段：语义数据 + `itemProps` + `control` + `visible` |
| itemProps | 待展开到 `Form.Item` 的纯数据绑定 props，无样式键 |
| metaConverter | widget 定义里的钩子，把 field 转成控件 / Form.Item props |
| 声明式 condition | 用 `{ field, op, value }` 描述的显隐条件，可 JSON 序列化 |
