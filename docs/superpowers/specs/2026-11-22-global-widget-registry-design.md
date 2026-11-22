# 全局自定义 Widget 注册表设计（字符串 id 引用自定义组件）

日期：2026-11-22
状态：待评审
关系：在现有表单级 `widgets` prop 与内置 `WIDGETS` 表之上，把自定义组件纳入项目级默认配置；不改变内置 widget 与现有 prop 的语义。

## 意图

外部项目里常有自己的业务组件（标签输入、级联选择、评分、上传等）。Schema 往往由配置或后端下发，只能携带字符串 id，组件必须从一个注册中心按 id 解析，而不能在 schema 里内联 JSX。

现状：

- 内置控件在 `WIDGETS` 表里按 id 注册；
- 表单级 `widgets` prop 可以注册自定义 id，但每个 `<SchemaForm>` / `<SchemaFields>` / `useFormSchema` 调用都要重复传一遍；
- 项目级默认配置（`configureSchemaForm`）目前只管理 `presets` / `converters` / `locale`，**不接管 widgets**。

本特性把自定义组件注册表提升到项目级：入口注册一次，任意 schema 用字符串 `widget: 'my-id'` 引用；表单级 prop 只做覆盖和补充。

## 一句话边界

**项目入口注册一次自定义组件；schema 只写字符串 id；表单级 `widgets` 按 id 覆盖全局，不继承拼装。**

全局注册表与内置表、表单级 prop 三层合并；不引入 React Context Provider，不在 schema 里写渲染函数。

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
import { CitySelector, TagInput } from './components';

configureSchemaForm({
  widgets: {
    // 简写：直接传组件
    'city-selector': CitySelector,
    // 定义对象：组件 + 可选 metaConverter
    'tag-input': {
      component: TagInput,
      metaConverter: ({ field }) => ({ valuePropName: 'checked' }),
    },
  },
});
```

之后任意 schema 用字符串 id 引用：

```tsx
const meta: FormSchema = {
  fields: [
    { key: 'city', label: '城市', widget: 'city-selector' },
    { key: 'tags', label: '标签', widget: 'tag-input', widgetProps: { mode: 'multiple' } },
  ],
};

<SchemaForm meta={meta} />;
```

局部覆盖或补充：

```tsx
// 同名 id：表单级覆盖全局；未覆盖的全局 id 继续可用
<SchemaForm meta={meta} widgets={{ 'city-selector': OtherCitySelector }} />;
```

### 注册项两种形状

| 形状 | 写法 | 归一化结果 |
| --- | --- | --- |
| 组件简写 | `'city-selector': CitySelector` | `{ component: CitySelector }` |
| 定义对象 | `'tag-input': { component, metaConverter? }` | 原样保留，`metaConverter` 可选 |

简写只是语法糖，解析层统一拿到 `WidgetDef`；两种形状可以混在同一个注册表里。

## 类型

```ts
/** 注册表项：裸组件简写，或带可选 metaConverter 的定义对象。 */
export type WidgetInput = WidgetDef | ComponentType<any>;

export interface SchemaFormDefaults {
  /** 项目默认 presets；与表单级 presets 按 key 合并，表单级优先。 */
  presets?: Presets;
  /** 项目默认 converter 注册表；与表单级注册表按 id 合并，表单级优先。 */
  converters?: Record<string, FieldConverter>;
  /** 项目默认 locale；表单级 locale 优先，最终兜底 zh-CN。 */
  locale?: string;
  /** 项目默认 widget 注册表；与表单级 widgets 按 id 合并，表单级优先。 */
  widgets?: Record<string, WidgetInput>;
}

export interface UseFormSchemaOptions {
  /** 本地 widget 注册 / 覆盖，优先级高于全局默认与内置控件。 */
  widgets?: Record<string, WidgetInput>;
  // ...其余字段不变
}
```

### 自定义组件 props 契约

注册表解析出的组件收到两类 props：

1. `Form.Item` 注入的值绑定：`value`（或 `valuePropName` 指定的键）、`onChange`、`id`；
2. 派生控件属性：`options`、`placeholder`、`disabled`、`readOnly`，以及字段 `widgetProps` 与预设简写属性合并后的其余 props。

导出类型供业务组件标注 props：

```ts
/** 注册控件收到的 props：Form.Item 值绑定 + 派生控件属性。 */
export interface WidgetComponentProps {
  value?: any;
  onChange?: (value: any) => void;
  options?: NormalizedOption[];
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  /** 字段 widgetProps 与预设简写属性合并后的其余 props。 */
  [prop: string]: any;
}
```

组件不需要消费的 props（如 antd 原生组件忽略未知属性）直接忽略即可；契约不要求组件实现特定接口。

## 完整组件定义示例

一个完整的自定义控件由两部分组成：**受控组件本身**（按 props 契约接收值绑定与派生属性）+ **注册定义**（`component` 必填，`metaConverter` 可选）。

### 组件实现

```tsx
// src/components/TagInput.tsx
import { Input, Space, Tag } from 'antd';
import { useState } from 'react';
import type { WidgetComponentProps } from '@jswork/antd-form-schema';

/** 组件自身额外 props；widgetProps 里的其余属性由索引签名透传。 */
interface TagInputProps extends WidgetComponentProps {
  /** 最多标签数，默认 5。 */
  max?: number;
}

/**
 * 标签输入控件（完整自定义组件）。
 * - value：字符串 | 字符串数组 | null / undefined，由 Form.Item 注入；
 * - onChange：回传下一个值，直接传值即可；事件形态 { target: { value } } 由内置
 *   getValueFromEvent 兜底解包，组件内部不必处理；
 * - disabled / readOnly / placeholder / options 为派生属性，按需要消费。
 */
export function TagInput({
  value,
  onChange,
  disabled,
  readOnly,
  placeholder,
  max = 5,
}: TagInputProps) {
  const tags: string[] = Array.isArray(value)
    ? value
    : value == null
      ? []
      : [String(value)];
  const [draft, setDraft] = useState('');

  const emit = (next: string[]) => onChange?.(next.slice(0, max));

  const add = () => {
    const next = draft.trim();
    if (!next || tags.includes(next)) return;
    emit([...tags, next]);
    setDraft('');
  };

  return (
    <Space wrap>
      {tags.map((tag) => (
        <Tag
          key={tag}
          closable={!disabled && !readOnly}
          onClose={() => emit(tags.filter((t) => t !== tag))}
        >
          {tag}
        </Tag>
      ))}
      {tags.length < max && (
        <Input
          size="small"
          style={{ width: 120 }}
          placeholder={placeholder ?? '输入后回车'}
          value={draft}
          disabled={disabled || readOnly}
          onChange={(e) => setDraft(e.target.value)}
          onPressEnter={add}
        />
      )}
    </Space>
  );
}
```

### 注册定义

```ts
// src/schema/widgets.ts（项目入口执行一次）
import { configureSchemaForm } from '@jswork/antd-form-schema';
import { TagInput } from '../components/TagInput';
import { CitySelector } from '../components/CitySelector';

configureSchemaForm({
  widgets: {
    // 简写：裸组件，归一化为 { component: CitySelector }
    'city-selector': CitySelector,
    // 完整定义：组件 + 可选 metaConverter
    'tag-input': {
      component: TagInput,
      // metaConverter：把字段 schema 转成控件 props / Form.Item props
      metaConverter: ({ field }) => ({
        widgetProps: { max: 5, ...field.widgetProps },
      }),
    },
  },
});
```

### Schema 引用

```tsx
const meta: FormSchema = {
  fields: [
    { key: 'city', label: '城市', widget: 'city-selector', placeholder: '请选择城市' },
    { key: 'tags', label: '标签', widget: 'tag-input', widgetProps: { max: 8 } },
  ],
};

<SchemaForm meta={meta} />;
```

### 定义部位对照

| 定义部位 | 作用 | 是否必填 |
| --- | --- | --- |
| `component` | 受控控件；接收值绑定（`value` / `onChange`）与派生属性 | 必填 |
| `metaConverter` | 字段 → 控件 / Form.Item props 的转换：合并 `widgetProps`、声明 `valuePropName` 等 | 可选 |
| 组件 props | `value` / `onChange` / `options` / `placeholder` / `disabled` / `readOnly` / `...widgetProps` | 按需要消费，不消费的忽略 |

复选框、开关这类非 `value` 键的控件，在 `metaConverter` 里声明 `valuePropName`：

```ts
{
  component: SwitchLike,
  metaConverter: () => ({ valuePropName: 'checked' }),
}
```

## 解析与合并

### 生效位置

合并统一放在 `useFormSchema` 内部。`SchemaForm` 和 `SchemaFields` 只透传表单级 props，三个入口得到完全一致的注册表。

```ts
const defaults = getSchemaFormDefaults();
const mergedWidgets = mergeWidgets(defaults.widgets, options?.widgets);
```

合并后的表同时喂给 `validateMeta` 与 `resolveWidget`（编辑态与查看态 `viewWidget` 走同一套解析）。

### 合并规则

```ts
mergeWidgets(global?, local?): Record<string, WidgetDef>
  → 全局项逐项 normalizeWidgetDef，本地项逐项 normalizeWidgetDef
  → { ...normalizedGlobal, ...normalizedLocal }
```

- 同一个 id，表单级覆盖全局；
- 表单级只注册部分 id 时，其余全局 id 继续可用；
- 全局未注册、本地也未注册的字符串 id，落到内置 `WIDGETS`；内置仍无匹配则按现有规则兜底为 `input`，并在开发环境校验报错；
- 直接传组件（非字符串）的 `widget` / `viewWidget` 不参与注册表查找，也不参与字符串 id 校验，保持现有逃生舱语义。

### 校验

`validateMeta` 收到合并后的完整表（内置 + 全局 + 本地）：

- 字符串 id 在内置表、全局表、本地表任一命中即视为已注册；
- 都未命中：开发环境抛 `unregistered widget "<id>"`（查看态对应 `unregistered viewWidget`），与现有规则一致；
- 组件简写在合并阶段已归一化为定义对象，校验层不需要感知简写形状。

## 优先级

### widget 解析

```text
表单级 widgets[id]
  → 全局默认 widgets[id]
  → 内置 WIDGETS[id]
  → 兜底 input（开发环境校验报错）
```

### 控件属性（不变）

```text
字段 schema 显式属性
  → 表单级 / 全局 presets 简写属性
  → 字段 widgetProps 逐 key 覆盖预设
```

### viewWidget

```text
表单级 widgets[id] → 全局 widgets[id] → 内置 span
```

## 示例

组件实现与注册定义见「完整组件定义示例」。入口把 widgets 与其他项目级配置一起装配：

```ts
// main.ts
configureSchemaForm({
  locale: 'zh-CN',
  presets: projectPresets,
  converters: projectConverters,
  widgets: projectWidgets,
});
```

局部覆盖某个 id，不影响全局其他注册项：

```tsx
<SchemaForm meta={meta} widgets={{ rate: OtherRate }} />;
```

## 非目标

- 不向自定义组件注入 `field` / `form` / `values` 上下文；组件只接收值绑定与控件属性。需要整表上下文的场景后续单独立项。
- 不在 schema 里提供 `render` 渲染函数逃生舱；结构覆盖继续走现有 `slots.control` / `slots.field`。
- 不做按路由、按租户、按请求的动态注册表；这类场景继续使用表单级 `widgets` prop。
- 不改变内置 widget 的 `metaConverter` 行为，不改变 `valueType` / converter 现有语义。
- 不引入 React Context Provider 或额外根组件包裹。

## 约束与风险

1. **全局可变状态**：模块级配置是单例。SSR 多租户、同一进程内多项目共存时不适用，应使用表单级 props（与 presets / converters 现有约束一致）。
2. **必须在挂载前配置**：配置不是响应式的；挂载后再调用 `configureSchemaForm` 不会让已渲染表单更新。
3. **测试隔离**：每个测试文件在 `afterEach` 调用 `resetSchemaFormDefaults()`，避免全局注册表串场。
4. **组件引用稳定性**：注册表按 id 取值，组件引用本身不需要稳定引用；但内联在渲染期新建的组件类型会导致控件重挂载，业务侧应在模块级定义组件。
5. **简写归一化时机**：简写只在合并层归一化；`getSchemaFormDefaults()` 快照保留原始 `WidgetInput` 形状，不深拷贝组件。

## 涉及文件

- 修改 `packages/lib/src/core/types.ts`：新增 `WidgetInput`；`SchemaFormDefaults.widgets`；`UseFormSchemaOptions.widgets` 放宽；导出 `WidgetComponentProps`。
- 修改 `packages/lib/src/widgets/index.tsx`：新增 `normalizeWidgetDef` 与 `mergeWidgets`。
- 修改 `packages/lib/src/core/defaults.ts`：`configureSchemaForm` 按字段浅合并 `widgets`；快照 / reset 覆盖 widgets。
- 修改 `packages/lib/src/useFormSchema.ts`：合并全局 + 本地注册表，喂给 `validateMeta` 与 `resolveWidget`。
- 修改 `packages/lib/src/components/SchemaFields.tsx` / `SchemaForm.tsx`：透传 prop 类型放宽为 `Record<string, WidgetInput>`。
- 新增 `packages/lib/__tests__/18-global-widget-registry.spec.tsx`：覆盖全局注册、简写、覆盖优先级、未注册报错、查看态解析、reset。
- 更新 `packages/example/src`：增加一个全局注册自定义组件的 demo 并接入演示站。
- 更新 `README.md`：增加「自定义控件 / 全局注册表」小节。

## 验收

- 入口 `configureSchemaForm({ widgets })` 注册的自定义组件，可被 schema 以字符串 `widget` / `viewWidget` 引用并正常渲染、绑定值。
- 注册表项支持裸组件简写与定义对象两种形状，可混用。
- 表单级 `widgets` 按 id 覆盖全局；未覆盖的全局 id 继续可用；内置表优先级最低。
- 未注册的字符串 id 在开发环境仍按现有规则报错；直接传组件不触发字符串校验。
- `SchemaForm` / `SchemaFields` / `useFormSchema` 三个入口得到相同的合并结果。
- `resetSchemaFormDefaults()` 彻底清空全局注册表；现有测试全绿，lib 与 example 类型检查通过。
