# 查看态改用 Descriptions 设计

日期：2026-11-21
状态：已实现（2026-11-21）
关系：替换 `2026-11-19-antd-form-schema-implementation-design.md` 中「查看态用 Form.Item + span」的渲染方式；保留 `viewWidget`、converter `read`、presets、条件显隐和隐藏字段语义。

## 意图

当前 `viewMode` 仍然把字段塞进 `Form.Item`，只是把编辑控件换成 `ViewSpan`：

```tsx
<Form.Item {...field.itemProps} label={field.label}>
  <ViewSpan initialValue={...} />
</Form.Item>
```

这能显示值，但不像详情页：

- 没有 `Descriptions` 的两列/多列布局；
- 没有 bordered、size、title、extra；
- 不能给「个人简介」这类字段单独设 `span={2}`；
- 标签和值仍然被 `Form.Item` 的表单语义包着，排版能力很弱；
- 业务里只能像 `detail-edit-demo.tsx` 那样手写一份 `Descriptions`，同一份 schema 实际被写了两遍。

目标是把查看态改成 Ant Design `Descriptions` 渲染：**同一份 schema，`viewMode: false` 渲染编辑表单，`viewMode: true` 渲染详情描述列表。**

## 一句话边界

**`viewMode` 为 true 时，`SchemaFields` / `SchemaForm` 用 `Descriptions` 渲染可见字段；字段值仍由 `viewWidget`（默认 `span`）产生，`Descriptions` 只负责布局、标签和分栏。**

## 目标

- `meta.viewMode: true` 时输出 `<Descriptions>`，而不是一堆只读 `Form.Item`。
- 支持 `column`、`bordered`、`size`、`layout`、`title`、`extra` 等常用详情页配置。
- 支持字段级 `viewSpan`，例如个人简介占两列。
- 保留 `viewWidget` 逃生舱，状态标签这类内容可以自定义渲染。
- 保留 option label 解析、converter `read`、条件显隐、隐藏字段取值。
- 查看态不显示必填星号、校验错误和编辑控件。

## 非目标

- 不做查看/编辑混合栅格。`meta.viewMode: true` 时整个表单进入查看态。
- 不接管详情接口请求、加载态、编辑态切换；这些仍由使用者的页面控制。
- 不新增 `Descriptions` 的 item 级任意属性透传；先只提供 `viewSpan`。
- 不把布局写回字段编辑态；`Descriptions` 只影响 `viewMode`。

## API

### FormSchema.view

新增表单级查看态配置：

```ts
export interface ViewConfig {
  title?: ReactNode;
  extra?: ReactNode;
  column?: number;
  bordered?: boolean;
  size?: 'default' | 'middle' | 'small';
  layout?: 'horizontal' | 'vertical';
  colon?: boolean;
  className?: string;
}

export interface FormSchema {
  viewMode?: boolean;
  view?: ViewConfig;
  // ...
}
```

默认值：

```ts
const DEFAULT_VIEW: ViewConfig = {
  column: 2,
  bordered: true,
  size: 'small',
};
```

也就是不写 `view` 时，查看态默认就是详情页常见的「两列、带边框、小尺寸」。

`view` 只在 `viewMode: true` 时生效；编辑态完全忽略。

### FieldSchema.viewSpan

字段级跨列：

```ts
export interface FieldSchema {
  viewSpan?: number;
}
```

渲染为：

```tsx
<Descriptions.Item label={field.label} span={field.viewSpan}>
  {field.viewContent}
</Descriptions.Item>
```

不写时按 `Descriptions` 默认一列处理。

### FieldSchema.viewProps

查看态专用控件属性：

```ts
export interface FieldSchema {
  viewProps?: Record<string, any>;
}
```

用途是给 `viewWidget` 传查看态独有的 props，例如自定义状态标签的颜色映射。它不会传给编辑态控件。

合并顺序：

```text
widgetProps
  → viewProps
  → initialValue（最终值，始终覆盖）
```

`viewProps` 不能覆盖 `initialValue`，避免配置把真实值盖掉。

### viewWidget 不变

`viewWidget` 继续存在，默认 `span`：

```ts
{ key: 'status', viewWidget: 'tag-view', viewProps: { activeColor: 'green' } }
```

字符串 id 仍在 `widgets` 注册表或内置 `WIDGETS` 中解析；直接传组件仍是逃生舱。查看态校验会额外检查 `viewWidget` 是否注册。

## 渲染结构

`SchemaFields` 检测到 `activeMeta.viewMode === true` 时，不再逐个渲染 `Form.Item`，而是走新的 `SchemaView`：

```tsx
<Descriptions
  title={view?.title}
  extra={view?.extra}
  column={view?.column ?? 2}
  bordered={view?.bordered ?? true}
  size={view?.size ?? 'small'}
  layout={view?.layout}
  colon={view?.colon}
  className={view?.className}
>
  {visibleFields.map((field) => (
    <Descriptions.Item
      key={field.key}
      label={labelOf(field)}
      span={field.viewSpan}
    >
      {contentOf(field)}
    </Descriptions.Item>
  ))}
</Descriptions>
```

可见字段没有 `Form.Item` 后，`onFinish` 只会收集已注册字段；因此 `SchemaView` 为每个可见字段额外挂一个 `Form.Item noStyle` 值载体，并清空 `rules`。载体只负责把值注册进 Form，不渲染 UI，也不触发查看态校验。

隐藏字段不进入 `Descriptions`，但仍挂载为 `Form.Item hidden`，保证提交时值还在：

```tsx
{renderableFields
  .filter((field) => field.hidden)
  .map((field) => (
    <Form.Item {...field.itemProps} key={field.key} hidden>
      {field.control}
    </Form.Item>
  ))}
```

`SchemaForm` 仍然保留 `<Form>` 外壳和 `initialValues`，因此查看态下 `form.getFieldsValue()`、`onFinish` 和隐藏字段行为不变。

## 字段值如何来

查看态的内容仍是 `field.viewContent`：

```ts
const viewValue = readConvertedValue(storedValue, chain, field, values, meta);
const viewContent = createElement(viewWidgetComponent, {
  ...getControlProps(viewField),
  ...field.viewProps,
  initialValue: viewValue,
});
```

因此：

- option 字段显示 label，而不是原始 value；
- converter `read` 仍然生效；
- 自定义 `viewWidget` 仍然收到 `initialValue` 和 `options`；
- 查看态不触发 converter `write`。

`SchemaView` 直接把 `viewContent` 放进 `Descriptions.Item`，不再依赖 `Form.Item` 注入 `initialValue`；该值已由 hook 显式计算并传入。

## 模式优先级

```text
meta.viewMode === true
  → 整个表单使用 Descriptions（字段级 viewMode:false 被忽略）

meta.viewMode !== true && field.viewMode === true
  → 该字段仍按旧方式渲染为只读 Form.Item + viewContent
```

说明：

- `meta.viewMode: true` 是容器级决定，不能在同一张 Descriptions 里混入编辑控件，所以字段级 `viewMode: false` 不再生效。
- 单字段查看态仍保留旧行为，避免影响只用 `field.viewMode` 的调用方。
- 这是对现有「field-level false 覆盖 form-level true」测试的破坏性变更，实施时同步修改测试和文档。

## 标签、插槽与 classNames

- 标签优先使用 `slots.label`，否则使用 `field.label`。
- 查看态不渲染必填星号，也不渲染校验错误。
- `slots.control` 仍然包裹查看态内容；`slots.field` 在查看态没有 `Form.Item` 可包裹，忽略。
- `classNames.field` 应用到 `Descriptions.Item` 的 `className`。
- `classNames.label` / `classNames.control` 分别包裹标签和内容。
- `classNames.form` 仍只作用于外层 `Form`；`Descriptions` 根节点用 `view.className`。
- `field.className` 在查看态也应用到 `Descriptions.Item`。

## 示例

### 一份 schema 同时服务详情与编辑

```tsx
const detailMeta: FormSchema = {
  viewMode: true,
  view: {
    bordered: true,
    size: 'small',
    column: 2,
  },
  initialValues: detail,
  fields: [
    { key: 'name' },
    { key: 'nickname' },
    { key: 'email' },
    { key: 'phone' },
    { key: 'role' },
    { key: 'status', viewWidget: StatusTag },
    { key: 'birthday' },
    { key: 'id' },
    { key: 'bio', viewSpan: 2 },
  ],
};

<SchemaForm
  meta={{ ...detailMeta, viewMode: !editing }}
  presets={presets}
  locale="zh-CN"
  onFinish={handleSave}
>
  {editing && <EditButtons />}
</SchemaForm>;
```

查看态输出等价于：

```tsx
<Descriptions bordered size="small" column={2}>
  <Descriptions.Item label="姓名">{detail.name}</Descriptions.Item>
  <Descriptions.Item label="昵称">{detail.nickname}</Descriptions.Item>
  ...
  <Descriptions.Item label="个人简介" span={2}>{detail.bio}</Descriptions.Item>
</Descriptions>
```

### 自定义状态标签

```tsx
const StatusTag = ({ initialValue, options }: any) => {
  const label = options?.find((item: any) => item.value === initialValue)?.label ?? initialValue;
  return <Tag color={initialValue === 'active' ? 'green' : 'default'}>{label}</Tag>;
};

const meta: FormSchema = {
  viewMode: true,
  fields: [{ key: 'status', viewWidget: StatusTag }],
};
```

### 字段级单字段查看态保持旧行为

```tsx
const meta: FormSchema = {
  fields: [
    { key: 'name' },
    { key: 'note', viewMode: true },
  ],
};
```

`note` 仍渲染为只读 `Form.Item`，`name` 仍是编辑控件；整个表单不走 Descriptions。

## 类型改动

```ts
export interface ViewConfig {
  title?: ReactNode;
  extra?: ReactNode;
  column?: number;
  bordered?: boolean;
  size?: 'default' | 'middle' | 'small';
  layout?: 'horizontal' | 'vertical';
  colon?: boolean;
  className?: string;
}

export interface FieldSchema {
  viewSpan?: number;
  viewProps?: Record<string, any>;
}

export interface FormSchema {
  viewMode?: boolean;
  view?: ViewConfig;
}

export interface BoundField {
  viewSpan?: number;
  viewProps?: Record<string, any>;
}
```

`UseFormSchemaResult` 不变；headless 使用方仍可拿 `viewContent` 自己渲染 `Descriptions`。

## 影响范围

- `packages/lib/src/core/types.ts`：新增 `ViewConfig`、`viewSpan`、`viewProps`。
- `packages/lib/src/useFormSchema.ts`：
  - `meta.viewMode === true` 时强制 `isView`；
  - 查看态合并 `viewProps`；
  - `BoundField` 带出 `viewSpan` / `viewProps`。
- `packages/lib/src/core/validate.ts`：校验 `viewWidget` 注册、`viewSpan` 合法性。
- `packages/lib/src/components/SchemaFields.tsx`：新增 `SchemaView` 分支。
- 新增 `packages/lib/src/components/SchemaView.tsx`。
- `packages/example/src/components/view-edit.tsx`：改成描述列表展示。
- `packages/example/src/components/detail-edit-demo.tsx`：删除手写 `Descriptions`，改用 schema 的查看态。
- `README.md`：更新查看态说明和示例。

## 验收标准

- `meta.viewMode: true` 时 DOM 中出现 `.ant-descriptions`，可见字段不再生成可见 `Form.Item`。
- `view.column` / `bordered` / `size` / `title` / `extra` 正确透传。
- `viewSpan: 2` 让字段占两列。
- option 字段显示 label；converter `read` 在查看态生效。
- 自定义 `viewWidget` 能渲染 Tag 等非纯文本内容。
- `hidden` 字段不出现在 Descriptions 中，但提交值仍在。
- 条件隐藏字段不出现在 Descriptions 中。
- `meta.viewMode: true` 时字段级 `viewMode: false` 被忽略。
- `meta.viewMode` 关闭时，字段级 `viewMode: true` 仍按旧方式渲染。
- 现有测试除「field-level false 覆盖 form-level true」外全部通过；新增 Descriptions 渲染测试。

## 风险与取舍

1. **破坏性变更**：`meta.viewMode: true` 下字段级 `viewMode: false` 失效。理由是 Descriptions 是容器级布局，混入编辑控件会破坏标签、校验和列布局。
2. **查看态不再有 Form.Item 校验 UI**：查看态本就不应该提交或校验；隐藏字段仍保留 Form.Item。
3. **`viewSpan` 只支持数字**：不暴露 `'filled'`、响应式 column 等更复杂的 Descriptions 能力，避免首版 API 过宽。
4. **`viewProps` 仅给 `viewWidget`**：不用于 `Descriptions.Item`；需要 item 级样式时用 `field.className` 或 `view.className`。
