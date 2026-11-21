# 字段值适配器设计（converters）

日期：2026-11-21
状态：待实现（MVP）

## 意图

业务表单里有一类「同一个字段，存储形态与控件形态不一致」的问题：

- 金额以分存储，界面按元编辑；
- 比例存小数，界面按百分数；
- 对象存 JSON 字符串，界面用结构化控件；
- 标签存数组，界面用逗号串；
- 同一个金额字段，还要按币种决定显示单位。

现在这些只能在 `itemProps` 里手写 `getValueProps` / `getValueFromEvent`。使用者必须懂 antd / rc-field-form 的内部约定，转换逻辑散落在业务组件中，无法复用、无法统一测试。

现有机制都覆盖不了：

- `valueType` 只服务日期类 widget，继续加类型会无限膨胀；
- `normalizeValues` 是提交前的整表单向收口，管不了回显方向，也无法按字段复用；
- widget 的 `metaConverter` 属于控件实现，不该承载业务语义。

所以需要一个字段级的双向值适配层。

## 一句话边界

**converter 是「字段值适配器」：读整张表单，只写本字段。**

`ctx.values` 提供整表快照，converter 可以据此决定本字段怎么显示、怎么存；但它的返回值只作用于当前字段。跨字段派生（改 A 自动生成 B）不属于 converter，另由表单级 `derive` 承担。

| 行为 | 是否允许 |
| --- | --- |
| 读 `ctx.values` 决定本字段的显示/存储 | 允许 |
| 写回本字段的存储值 | 允许 |
| 返回时顺手改别的字段 | 不允许 |
| 在 converter 里调用 form API | 不允许 |
| 改 A 自动生成 B | 不在本特性，交给 `derive` |

判断标准：一次 converter 只回答「这个字段现在该显示什么 / 该存什么」，不回答「表单还应该变成什么」。

## 用法（拍板形状）

### 注册表

converter 放独立注册表，字段只引用 id。schema 保持纯数据，YAML / JSON / 数据库里的 meta 不需要携带函数。

```ts
// converters.ts
import type { FieldConverter } from '@jswork/antd-form-schema';

export const converters: Record<string, FieldConverter> = {
  // 存储：分（整数）；控件：元
  money: {
    read: (value) => (value == null ? value : Number(value) / 100),
    write: (value) => (value == null ? value : Math.round(Number(value) * 100)),
  },

  // 存储：小数；控件：百分数
  percent: {
    read: (value) => (value == null ? value : Number(value) * 100),
    write: (value) => (value == null ? value : Number(value) / 100),
  },

  // 存储：JSON 字符串；控件：对象
  json: {
    read: (value) => {
      if (value == null || value === '') return value;
      try {
        return typeof value === 'string' ? JSON.parse(value) : value;
      } catch {
        return value; // 坏数据原样交给控件，避免表单白屏
      }
    },
    write: (value) => (value == null ? value : JSON.stringify(value)),
  },
};
```

### schema

```ts
const meta: FormSchema = {
  name: 'order-form',
  fields: [
    { key: 'amount', widget: 'number', converter: 'money' },
    { key: 'discount', widget: 'number', converter: 'percent' },
    { key: 'extra', widget: 'textarea', converter: 'json' },
  ],
};
```

### 组件与 hook

```tsx
<SchemaForm meta={meta} converters={converters} presets={presets} />
```

```ts
useFormSchema(meta, form, { converters, presets, locale });
```

`SchemaFields` 同名 prop，优先级与 `SchemaForm` 一致。

### 契约

```ts
export interface ConverterContext {
  /** 当前字段（已归一化） */
  field: NormalizedField;
  /** 当前整表 values 快照，只读 */
  values: Record<string, any>;
  /** 当前 schema，只读 */
  meta: FormSchema;
}

export interface FieldConverter {
  /** 存储值 → 控件值（回显）；缺省原样透传 */
  read?: (value: any, ctx: ConverterContext) => any;
  /** 控件值 → 存储值（写回）；缺省原样透传 */
  write?: (value: any, ctx: ConverterContext) => any;
}
```

命名说明：`read` 是从存储读出、给控件用；`write` 是控件写回存储。比 `toControl` / `toStore` 短，且方向固定——不要理解成「读文件」。

读取其他字段是允许的：

```ts
currencyAmount: {
  read: (value, ctx) =>
    value == null ? value : ctx.values.currency === 'USD' ? value / 100 : value,
  write: (value, ctx) =>
    value == null ? value : ctx.values.currency === 'USD' ? Math.round(value * 100) : value,
},
```

不允许调 `form.setFieldsValue`，也不存在「返回 patch 写别的 key」这种语义；`ConverterContext` 不暴露 form 实例。

### 错误与空值

- `undefined` / `null` 不预先短路，由 converter 自己决定（这样可以表达 `null → '-'`、`'' → undefined`）。
- converter 抛错：dev 下 `console.warn` 并回退原值，production 静默回退，不让表单崩。

## 方案对比

| 方案 | 形状 | 结论 |
| --- | --- | --- |
| A. 字段内联函数 | `{ key, converter: { read, write } }` | 否决：schema 不可序列化，YAML / 后端存 meta 直接失效，同一转换要重复写 |
| B. 独立注册表 + 字段引用 id | `converters: {...}`，字段 `converter: 'money'` | 采纳：可复用、可测试、schema 保持纯数据 |
| C. 不做，继续手写 `itemProps` | 调用方自己写 `getValueProps` | 否决：要求懂 antd 内部约定，逻辑散落，无法统一校验 |
| D. 并进 `valueType` | 增加 `'money' \| 'json' \| ...` | 否决：类型无限膨胀，且无法覆盖自定义业务转换 |

## 目标

- 字段通过 `converter: '<id>'` 完成存储值与控件值的双向转换。
- converter 可读整表 `values` 做上下文判断，结果只影响本字段。
- 视图态（`viewMode`）展示的值同样经过 `read`，不显示存储原值。
- 不传 `converters` 时行为与现在完全一致，零回归。

## 非目标 / 反目标

- 不做跨字段派生（改 A 生成 B），不在 converter 里写别的字段。
- 不做异步 converter（远程汇率、远程换算）；异步应在取详情或提交前完成。
- 不做嵌套路径的批量转换（`items[].price` 留给业务层）。
- 不允许 YAML 里直接写函数，只写 converter id。
- 不与 `valueType` 叠用：两个都改值，顺序无法解释。
- 不接管 `options` / `rules` / `required` / `placeholder` / 条件 / 视图态判定。

## 优先级

1. **`itemProps` 显式逃生舱最后赢**：字段 `itemProps` 里手写的 `getValueProps` / `getValueFromEvent` 优先于 converter。
2. **converter 与 `valueType` 互斥**：开发期校验报错 `converter "x" cannot be combined with valueType on field "y"`。
3. **未知 converter id**：dev 下抛错，风格与 `unregistered widget` 一致；生产回退为不转换。
4. **提交值以 store 为准**：`onFinish` 拿转换后的存储值，再叠加 `normalizeValues`。converter 管单字段双向，`normalizeValues` 管提交前整表收口。

## 配套设计：表单级 derive（独立特性，不在本期实现）

`derive` 与 converter 是两层，用来处理「改 A 自动生成 B」：

```ts
export interface DeriveContext {
  changedKeys: string[];
  values: Record<string, any>;
  meta: FormSchema;
}

export type Derive = (ctx: DeriveContext) => Record<string, any> | void;
```

```tsx
<SchemaForm
  meta={meta}
  converters={converters}
  derive={({ values }) => ({
    total: Number(values.price ?? 0) * Number(values.qty ?? 0),
  })}
/>
```

规则：

- 只挂在 `SchemaForm` 层，由 `onValuesChange` 触发，不在渲染期执行；
- 同一批变更只执行一次；
- 返回的 `patch` 不得包含本次 `changedKeys`；
- 派生写入不再触发 derive（一次性 guard），单层不递归；
- 不支持异步；
- `patch` 用 `form.setFieldsValue` 写回，不触发校验。

headless 使用者继续用自己的 `onValuesChange`，不强制使用这个 API。

## 实现要点

- `core/types.ts`：新增 `FieldConverter`、`ConverterContext`、`FieldSchema.converter?: string`、`UseFormSchemaOptions.converters`。
- 新建 `core/converters.ts`：
  - `resolveConverter(id, registry)` 解析 id；
  - `applyFieldConverter(field, itemProps, ctx)` 合并 `getValueProps` / `getValueFromEvent`；
  - 无 converter 时原样返回 `itemProps`，保证零回归；
  - try/catch 包裹调用，失败回退原值。
- `useFormSchema.ts`：在 widget 的 `applyConverter` 之后套业务 converter；`BoundField` 增加 `converter?: string` 便于调试；视图态取 `get(values, name)` 后先过 `read`。
- `components/SchemaForm.tsx` / `SchemaFields.tsx`：新增 `converters` prop 并向下传；`SchemaForm` 从 rest 中解构掉，避免透传给 antd `<Form>`。
- `core/validate.ts`：校验未知 id、`converter + valueType` 冲突。
- `index.tsx`：导出 `FieldConverter`、`ConverterContext`。
- README：增加 `converters` 用法与边界。

实现细节：`getValueFromEvent` 收到的是控件原始事件参数，先提取控件值（优先沿用 widget 已有的提取逻辑，否则按 antd 默认规则取 `target.value` / `checked` / 首参），再交给 `write`。

## 测试

- `money`：初始 1999 → 控件 19.99；输入 20.5 → store 2050；`null` 透传。
- `percent`：0.15 ↔ 15。
- `json`：合法 JSON 字符串回显对象；对象写回字符串；坏字符串原样回显且不抛错。
- 上下文读取：`currency` 变化后，本字段 `read` 结果随之变化。
- 视图态：`viewMode` 下 span 显示转换后的值。
- 优先级：`itemProps.getValueProps` 覆盖 converter；`converter + valueType` 报错；未知 id 报错。
- 回归：不传 `converters` 时既有 128 条用例全过。
- 异常：converter 抛错时回退原值并告警（dev）。

## 规模

- 新增 2 个类型、1 个核心文件，约 120 行实现；改 4 个入口文件、1 个校验函数。
- 不动 widget 层、condition、presets。
- 预计新增 12–15 条测试。

## 未决问题

- 日期类字段若要同时做业务换算，当前规定为互斥；是否需要在 converter 内部自行调用日期转换，等真实用例再定。
- `derive` 是否需要进入下一期，取决于是否存在「一个字段变更驱动多个字段」的实际表单；先不实现。
