# SchemaForm 全局默认配置设计

日期：2026-11-21
状态：待评审
关系：在 `SchemaForm` / `SchemaFields` / `useFormSchema` 现有 props 之上增加项目级默认值，不改变任何表单级 prop 的语义。

## 意图

`presets`、`converters`、`locale` 这三项在同一个项目里通常高度重复：presets 是团队共用的字段字典，converters 是业务通用的值转换器，locale 基本固定为中文。

现在每个 `<SchemaForm>` 都要重复传一遍：

```tsx
<SchemaForm
  meta={a}
  presets={presets}
  converters={converters}
  locale="zh-CN"
/>

<SchemaForm
  meta={b}
  presets={presets}
  converters={converters}
  locale="zh-CN"
/>
```

本特性提供一次性的项目级配置，让表单只在需要覆盖时才写这些 prop。

## 一句话边界

**项目启动时配置一次默认值；表单级 prop 只负责覆盖，不负责继承拼装。**

全局只管理 `presets`、`converters`、`locale` 三项，不接管 widgets、slots、classNames、校验开关。

## API 形态

```ts
import {
  configureSchemaForm,
  getSchemaFormDefaults,
  resetSchemaFormDefaults,
} from '@jswork/antd-form-schema';
```

项目入口配置一次：

```ts
configureSchemaForm({
  locale: 'zh-CN',
  presets: projectPresets,
  converters: projectConverters,
});
```

之后所有入口自动生效：

```tsx
// SchemaForm
<SchemaForm meta={meta} />

// SchemaFields
<Form>
  <SchemaFields meta={meta} />
</Form>

// headless
useFormSchema(meta, form);

// 只在需要覆盖时写
<SchemaForm meta={meta} locale="en-US" />
```

### 函数语义

| API | 行为 |
| --- | --- |
| `configureSchemaForm(defaults)` | 按字段浅合并到当前全局配置；未提供的字段保留原值。 |
| `getSchemaFormDefaults()` | 返回当前生效配置的只读副本，便于调试和测试断言。 |
| `resetSchemaFormDefaults()` | 清空全局配置，恢复到「没有全局默认值」。测试和 HMR 使用。 |

配置只在组件挂载前生效。挂载后修改全局配置不会触发已渲染表单重绘，这一点和 React `defaultProps` 的静态语义一致。

## 类型

```ts
export interface SchemaFormDefaults {
  /** 项目默认 presets；与表单级 presets 按 key 合并，表单级优先。 */
  presets?: Presets;
  /** 项目默认 converter 注册表；与表单级注册表按 id 合并，表单级优先。 */
  converters?: Record<string, FieldConverter>;
  /** 项目默认 locale；表单级 locale 优先，最终兜底 zh-CN。 */
  locale?: string;
}
```

不新增 `SchemaForm` 的静态属性，也不使用 React 的 `defaultProps`：

1. React 19 已不再为函数组件应用 `defaultProps`；
2. `SchemaForm.defaultProps` 无法覆盖 `useFormSchema` 这类 headless 调用；
3. 模块级配置可以被三个入口共享，语义更直接。

## 解析与合并

### 生效位置

合并统一放在 `useFormSchema` 内部。`SchemaForm` 和 `SchemaFields` 只负责把表单级 props 透传给 hook，因此三个入口天然一致。

```ts
const defaults = getSchemaFormDefaults();

const presets = mergePresets(defaults.presets, options?.presets);
const converters = { ...defaults.converters, ...options?.converters };
const locale = options?.locale ?? defaults.locale ?? 'zh-CN';
```

顺序必须是「先合并 presets，再 applyPresets」，这样全局 presets 里的 widget id 也会参与 `validateMeta`。

### presets 合并

全局和表单级 `presets` 都先归一化为分段结构：

```ts
{
  fields: Record<string, PresetField>,
  labels: Record<string, Record<string, string>>,
}
```

扁平 label 表 `Record<string, string>` 视为默认语言 `zh-CN` 的 labels。

合并规则：

```ts
fields = { ...global.fields, ...local.fields };
labels = 按 locale 逐层合并:
  { ...global.labels[loc], ...local.labels[loc] }
```

- 同一个 key，表单级覆盖全局。
- 表单级只配一部分 key 时，其余 key 继续使用全局。
- 表单级只配 `en-US` 时，全局的 `zh-CN` labels 仍然保留。
- presets 中存在但 schema 没有的 key 仍然被忽略，presets 永不创建字段。

### converters 合并

```ts
const merged = { ...global.converters, ...local.converters };
```

- 同一个 id，表单级实现覆盖全局实现。
- 表单级只注册部分 id 时，其余 id 继续可用。
- `meta.converters`（字段 key → converter id）语义完全不变，仍然只是引用，不参与注册表合并。

### locale

优先级：

```text
表单级 locale → 全局 locale → 内置 zh-CN
```

表单级传 `locale="zh-CN"` 可以显式把某个表单拉回中文，即使项目默认是英文。

## 完整优先级

### label

```text
字段 schema.label
  → 表单级 presets labels
  → 全局 presets labels
  → 内置 BUILTIN_LABELS
  → key 本身
```

### widget

```text
字段 schema.widget
  → 表单级 presets fields
  → 全局 presets fields
  → 内置默认 input
```

### converter 实现

```text
表单级 converters[id]
  → 全局 converters[id]
  → 未注册（开发环境报错）
```

字段 `converter` / `meta.converters[key]` 只决定引用哪个 id，不改变实现来源。

### locale

```text
表单级 locale → 全局 locale → zh-CN
```

## 示例

```ts
// schema-presets.ts
export const projectPresets = {
  fields: {
    title: 'input',
    status: 'select',
    enabled: 'switch',
  },
  labels: {
    'zh-CN': { title: '标题', status: '状态', enabled: '是否启用' },
    'en-US': { title: 'Title', status: 'Status', enabled: 'Enabled' },
  },
};

export const projectConverters = {
  money: {
    read: (value: unknown) =>
      value == null ? value : Number(value) / 100,
    write: (value: unknown) =>
      value == null ? value : Math.round(Number(value) * 100),
  },
};
```

```ts
// main.ts
configureSchemaForm({
  locale: 'zh-CN',
  presets: projectPresets,
  converters: projectConverters,
});
```

```tsx
// 任意业务表单，不再重复传三项
const meta: FormSchema = {
  fields: [
    { key: 'title' },
    { key: 'status' },
    { key: 'price', converter: 'money' },
  ],
};

<SchemaForm meta={meta} />;
```

```tsx
// 局部覆盖语言
<SchemaForm meta={meta} locale="en-US" />;
```

```tsx
// 局部补充一个 converter，不影响全局其他 id
<SchemaForm
  meta={meta}
  converters={{ ratio: ratioConverter }}
/>;
```

## 非目标

- 不接管 `widgets`、`slots`、`classNames`、`validate`。
- 不做 React Context Provider，不引入额外的根组件包裹。
- 不做按路由、按租户、按请求的动态配置；这类场景继续使用表单级 props。
- 不改变 `meta.converters` 的 key → id 映射语义。
- 不改变 presets 的「不创建字段」原则。

## 约束与风险

1. **全局可变状态**：模块级配置是单例。SSR 多租户、同一进程内多个项目共存时不适用，应使用表单级 props。
2. **必须在挂载前配置**：配置不是响应式的；挂载后再调用不会让现有表单更新。
3. **测试隔离**：每个测试文件在 `afterEach` 调用 `resetSchemaFormDefaults()`，避免全局状态串场。
4. **重复打包**：如果项目里存在多份库实例，每份实例各有自己的全局配置；这是模块单例的固有行为。
5. **HMR**：开发时模块重新执行可能丢失配置；在应用入口配置即可随入口重新执行。

## 涉及文件

- 新增 `packages/lib/src/core/defaults.ts`：全局配置读写、presets 归一化与合并。
- 修改 `packages/lib/src/useFormSchema.ts`：解析默认值并合并到 options。
- 修改 `packages/lib/src/index.tsx`：导出三个函数和 `SchemaFormDefaults` 类型。
- 修改 `packages/lib/src/core/types.ts`：增加 `SchemaFormDefaults`。
- 新增 `packages/lib/__tests__/15-global-defaults.spec.tsx`：覆盖三个入口、覆盖优先级、reset。
- 更新 `packages/example/src`：增加一个全局配置 demo。
- 更新 `README.md`：增加「项目级默认配置」小节。

## 验收

- 不传任何 props，`SchemaForm` 能使用全局 presets、converters、locale。
- `SchemaFields` 和 `useFormSchema` 得到完全相同的默认值。
- 表单级 `locale` 覆盖全局；表单级 presets 按 key 覆盖全局且保留未覆盖项；表单级 converters 按 id 覆盖全局。
- `configureSchemaForm` 连续调用按字段合并，`resetSchemaFormDefaults` 能彻底恢复。
- 全局注册的 converter 参与 `validateMeta`，未注册 id 仍按现有规则在开发环境报错。
- 现有测试全绿；lib 与 example 类型检查通过。
