# Preset 字段对象化设计（widget + 控件属性）

日期：2026-11-21
状态：待评审
关系：扩展 `2026-11-21-key-presets-design.md` 中 `fields` 的值类型，不改变 label 规则、locale 回退和「presets 不创建字段」原则。

## 意图

现在 `presets.fields` 的一个 key 只能写控件类型：

```ts
const presets: Presets = {
  fields: {
    title: 'input',
    name: 'input',
    status: 'select',
    bio: 'textarea',
    enabled: 'switch',
  },
};
```

但同一个控件在不同表单里经常需要不同的默认属性，例如：

- `title` 是 input，但默认 `placeholder` 是「请输入标题」，并且需要 `allowClear`；
- `status` 是 select，但默认 `placeholder` 是「请选择状态」，还要 `showSearch`；
- `bio` 是 textarea，但默认 `autoSize` 是 `{ minRows: 2, maxRows: 6 }`。

如果这些属性只能写在每个表单的 schema 里，presets 的价值就少了一半。本特性让 `fields[key]` 从「控件 id」扩展为「控件 id + 任意控件属性」。

## 一句话边界

**`fields[key]` 的字符串简写不变；对象形式除 `widget` 外的属性都作为控件 props 的默认值，schema 显式配置永远优先。**

## 配置形状

### 字符串简写（保持兼容）

```ts
fields: {
  title: 'input',
  status: 'select',
}
```

等价于：

```ts
fields: {
  title: { widget: 'input' },
  status: { widget: 'select' },
}
```

### 对象形式

```ts
fields: {
  title: {
    widget: 'input',
    placeholder: '请输入标题',
    allowClear: true,
    maxLength: 60,
  },
  status: {
    widget: 'select',
    placeholder: '请选择状态',
    showSearch: true,
  },
  bio: {
    widget: 'textarea',
    placeholder: '请输入个人简介',
    autoSize: { minRows: 2, maxRows: 6 },
  },
}
```

规则：

1. `widget` 是保留键，表示控件 id 或组件。
2. 除 `widget` 外的键默认都是控件 props，值可以是任意类型：字符串、数字、布尔、数组、对象，例如 `autoSize`。
3. 需要更明确地分组时，可以写 `widgetProps`：

```ts
fields: {
  title: {
    widget: 'input',
    placeholder: '请输入标题',
    widgetProps: {
      allowClear: true,
      maxLength: 60,
    },
  },
}
```

`widgetProps` 中的键与直接写在对象上的键等价；两边重复时 `widgetProps` 优先，因为它更显式。

### YAML 写法

```yaml
fields:
  title:
    widget: input
    placeholder: 请输入标题
    allowClear: true
  bio:
    widget: textarea
    placeholder: 请输入个人简介
    autoSize:
      minRows: 2
      maxRows: 6
```

YAML / JSON 只能表达可序列化值；函数型 props（例如自定义 `formatter`）使用 TS 配置文件。

## schema 侧写法不变

schema 里仍然只写 key：

```ts
const meta: FormSchema = {
  fields: [
    { key: 'title', required: true },
    { key: 'status' },
    { key: 'bio' },
  ],
};
```

需要覆盖单个字段属性时，直接写在 schema 上：

```ts
{
  key: 'title',
  widget: 'textarea',
  placeholder: '请输入长标题',
  widgetProps: { maxLength: 120 },
}
```

## 优先级

### widget

```text
schema.widget
  → presets.fields[key].widget
  → 内置默认 input
```

### 控件属性（逐 key 合并）

```text
schema.widgetProps[key]
  → schema 字段级 placeholder / disabled / readOnly / options
  → presets.fields[key].widgetProps[key]
  → presets.fields[key] 上的直接属性
  → 控件自身默认值
```

也就是说：

- schema 写了 `placeholder`，预设的 `placeholder` 不生效；
- schema 写了 `widgetProps.maxLength`，预设的 `maxLength` 不生效；
- schema 只覆盖了 `widget`，预设里的其他控件属性仍然生效，因为它们是这个 key 的默认值；
- 预设的 `widgetProps` 与直接属性重复时，`widgetProps` 优先。

## 示例

```ts
// presets.ts
export const presets: Presets = {
  fields: {
    title: {
      widget: 'input',
      placeholder: '请输入标题',
      allowClear: true,
    },
    status: {
      widget: 'select',
      placeholder: '请选择状态',
      showSearch: true,
    },
  },
  labels: {
    'zh-CN': { title: '标题', status: '状态' },
  },
};
```

```tsx
<SchemaForm
  meta={{
    fields: [
      { key: 'title' },
      { key: 'status', placeholder: '自定义占位' },
    ],
  }}
  presets={presets}
/>
```

结果：

- `title`：input，`placeholder = 请输入标题`，`allowClear = true`；
- `status`：select，`showSearch = true`，但 `placeholder` 使用 schema 的「自定义占位」。

## 类型改动

```ts
export interface PresetFieldObject {
  /** Widget id or component. */
  widget: Widget;
  /** Explicit widget props; wins over shorthand props on the same object. */
  widgetProps?: Record<string, any>;
  /** Shorthand control props, e.g. placeholder, allowClear, maxLength. */
  [prop: string]: any;
}

export type PresetField = string | PresetFieldObject;
```

`PresetsInput.fields` 仍为 `Record<string, PresetField>`，因此旧字符串写法不需要迁移。

## 作用范围

适用于所有读取 presets 的入口：

- `SchemaForm`
- `SchemaFields`
- `useFormSchema`
- 项目级 `configureSchemaForm({ presets })`

自定义 widget 同样适用：对象里的额外属性会原样传给自定义组件。

## 非目标

- presets 仍然不创建字段，schema 没出现的 key 继续忽略。
- 不改变 label 的 locale 回退和内置标签规则。
- 不把 `rules`、`required`、`condition`、`converter` 等字段语义搬进 presets；这些仍写在 schema。
- 不做 props 的类型校验；控件不认识的属性由控件或 React 自己处理，和直接写 `widgetProps` 一致。
- 不做全局与表单级 presets 的对象深合并：同一个 key 在表单级出现时，仍整体覆盖全局该 key 的配置。

## 实现要点

1. `core/types.ts`：新增 `PresetFieldObject`，扩展 `PresetField`。
2. `core/presets.ts`：
   - 读取 `PresetField` 时同时取出 `widget` 和控件 props；
   - 直接属性与 `widgetProps` 合并，`widgetProps` 优先；
   - 将预设 props 作为低优先级默认值合并到字段的控件层，schema 的 `widgetProps` 与字段级属性最后覆盖；
   - schema 已有 `widget` 时只合并 props，不覆盖 widget。
3. `validateMeta`：预设合并后仍校验生效 widget id，未知 id 继续报错。
4. README / example：presets 示例改成对象形式，至少展示 `placeholder`、布尔属性和对象属性各一个。

## 测试

1. 字符串简写回归：`title: 'input'` 仍按 input 渲染。
2. 对象 `placeholder`：`{ widget: 'input', placeholder: '请输入标题' }` 渲染出对应 placeholder。
3. 布尔 / 数字属性：`allowClear`、`maxLength` 透传到控件。
4. 对象属性：textarea 的 `autoSize` 原样透传。
5. `widgetProps` 与直接属性并存：重复 key 时 `widgetProps` 优先。
6. schema `placeholder` 覆盖预设 `placeholder`。
7. schema `widgetProps` 覆盖预设同名属性。
8. schema 覆盖 `widget` 时，预设其他 props 仍生效。
9. 全局 presets → 表单级 presets：同 key 对象整体覆盖，其他 key 继续继承。
10. 自定义 widget 收到预设 props。
11. 预设 widget 写成未知 id：仍走 `unregistered widget` 校验。
12. 不传 presets / 全部字符串简写：现有测试全绿。

## 验收

- `Presets['fields'][key]` 同时接受字符串和对象。
- 对象中的 `placeholder`、`allowClear`、`maxLength`、`autoSize` 等属性正确到达控件。
- schema 显式配置始终高于 presets。
- label、locale、字段创建规则零回归。
- README 与 example 能直接展示对象写法。
