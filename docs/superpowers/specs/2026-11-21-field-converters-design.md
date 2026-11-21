# 字段级 converter 设计（converters）

日期：2026-11-21

## 意图

业务表单里有一类「同一个字段，存储形态和控件形态不一致」的需求：金额以分存储、界面按元编辑；百分比存小数、界面按百分数；对象存 JSON 字符串、界面用结构化控件；标签存数组、界面用逗号串。现在这些只能在 `itemProps` 里手写 `getValueProps` / `getValueFromEvent`，要求使用者懂 antd / rc-field-form 的约定，逻辑散落在业务组件里，不能复用也不好测试。

`valueType` 只服务日期类 widget，`normalizeValues` 只在提交前做整表收口，都覆盖不了「按字段、双向」的转换。因此需要字段级的值适配能力。

边界必须先说清：**converter 是「字段值适配器」——读整张表单，只写本字段。** 它不做跨字段派生（改 A 自动生成 B）；那属于表单层职责。

## 用法（拍板形状）

converter 放独立注册表，字段只引用 id。schema 保持可序列化，YAML / JSON / DB 里的 meta 不需要带函数。

```ts
// converters.ts
import type { FieldConverter } from '@jswork/antd-form-schema';

export const converters: Record<string, FieldConverter> = {
  // 存储：分（整数）；控件：元
  money: {
    toControl: (value) => (value == null ? value : Number(value) / 100),
    toStore: (value) => (value == null ? value : Math.round(Number(value) * 100)),
  },

  // 存储：小数；控件：百分数
  percent: {
    toControl: (value) => (value == null ? value : Number(value) * 100),
    toStore: (value) => (value == null ? value : Number(value) / 100),
  },

  // 存储：JSON 字符串；控件：对象
  json: {
    toControl: (value) => {
      if (value == null || value === '') return value;
      try {
        return typeof value === 'string' ? JSON.parse(value) : value;
      } catch {
        return value; // 坏数据原样交给控件，避免表单白屏
      }
    },
    toStore: (value) => (value == null ? value : JSON.stringify(value)),
  },
};
```

```ts
// schema：只写 id
const meta: FormSchema = {
  name: 'order-form',
  fields: [
    { key: 'amount', widget: 'number', converter: 'money' },
    { key: 'discount', widget: 'number', converter: 'percent' },
    { key: 'extra', widget: 'textarea', converter: 'json' },
  ],
};
```

```tsx
<SchemaForm meta={meta} converters={converters} presets={presets} />
// SchemaFields / useFormSchema 同名参数，语义一致
```

```ts
useFormSchema(meta, form, { converters, presets, locale });
```

converter 的契约：

```ts
export interface ConverterContext {
  field: NormalizedField;
  /** 当前整表 values 快照，只读 */
  values: Record<string, any>;
  meta: FormSchema;
}

export interface FieldConverter {
  /** 存储值 → 控件值（回显）；缺省原样透传 */
  toControl?: (value: any, ctx: ConverterContext) => any;
  /** 控件值 → 存储值（写回）；缺省原样透传 */
  toStore?: (value: any, ctx: ConverterContext) => any;
}
```

允许读别的字段决定本字段怎么显示/存储：

```ts
currencyAmount: {
  toControl: (value, ctx) =>
    value == null ? value : ctx.values.currency === 'USD' ? value / 100 : value,
  toStore: (value, ctx) =>
    value == null ? value : ctx.values.currency === 'USD' ? Math.round(value * 100) : value,
},
```

不允许：在 converter 里调 `form.setFieldsValue`，或设计「返回 patch 让库写别的 key」。`ConverterContext` 不提供 form 实例，也没有 patch 语义。判断标准：一次 converter 只回答「这个字段现在该显示什么 / 该存什么」。

## 方案对比

| 方案 | 形状 | 问题 |
| --- | --- | --- |
| A. 字段内联函数 | `{ key, converter: { toControl, toStore } }` | schema 不可序列化；YAML / 后端存 meta 直接失效；同一转换在多个字段重复写 |
| B. 独立注册表 + 字段引用 id（采纳） | `converters: {...}`，字段 `converter: 'money'` | 多一层注册，但可复用、可测试、schema 保持纯数据 |
| C. 不做，继续手写 `itemProps` | 调用方自己写 `getValueProps` | 要求懂 antd 内部约定，转换逻辑散落，无法统一校验 |
| D. 并进 `valueType` | 继续加 `'money' \| 'json'` 等 | 类型会无限膨胀，且解决不了自定义业务转换 |

选 B。注册表放调用方代码里，库只负责按 id 解析和执行。

## 目标

- 字段可声明 `converter: '<id>'`，把存储值与控件值双向转换。
- converter 可读整表 `values` 做上下文判断，结果只影响本字段。
- 视图态（`viewMode`）展示的值同样经过 `toControl`，不显示存储原值。
- 不传 `converters` 时行为与现在完全一致，零回归。

## 非目标 / 反目标

- **不做跨字段派生**：converter 不写别的字段，不做「改 A 生成 B」。
- 不做异步 converter（远程汇率、远程换算）。异步应在取详情或提交前完成。
- 不做嵌套路径批量转换（`items[].price` 留给业务层）。
- 不做 YAML 直接写函数；YAML 里只写 converter id。
- 不与 `valueType` 叠用，避免「谁先转换」无法解释。

## 边界与优先级

| 行为 | 是否允许 |
| --- | --- |
| 读 `ctx.values` 决定本字段显示/存储 | 允许 |
| 写回本字段的存储值 | 允许 |
| 返回时顺手改别的字段 | 不允许 |
| 在 converter 里调 form API | 不允许 |

1. **converter 与 `valueType` 互斥**。开发期校验报错：`converter "x" cannot be combined with valueType on field "y"`。`valueType` 已被日期 widget 占用，再叠一层无法解释顺序。
2. **`itemProps` 显式逃生舱最后赢**。字段 `itemProps` 里手写的 `getValueProps` / `getValueFromEvent` 优先于 converter。
3. **converter 不接管** `options` / `rules` / `required` / `placeholder` / 条件 / 视图态判定，只碰值。
4. **提交值以 store 为准**：`SchemaForm.onFinish` 拿到转换后的存储值，再叠加 `normalizeValues` 的整表处理。converter 管单字段双向，`normalizeValues` 管提交前收口。
5. **未知 converter id 在 dev 下抛错**，风格与现有 `unregistered widget` 一致；生产环境回退为不转换。

## 实现要点

- `core/types.ts`：新增 `FieldConverter`、`ConverterContext`、`FieldSchema.converter?: string`、`UseFormSchemaOptions.converters`。
- 新建 `core/converters.ts`：
  - `resolveConverter(id, registry)` 解析 id；
  - `applyFieldConverter(field, converter, ctx)` 生成 `itemProps` 上的 `getValueProps` / `getValueFromEvent`；
  - 无 converter 时返回原 `itemProps`，保证零回归；
  - 调用点 try/catch：dev 下 `console.warn` 并回退原值，生产静默回退。
- `useFormSchema.ts`：在 widget 的 `applyConverter` 之后套业务 converter，`BoundField` 增加 `converter?: string` 便于调试。视图态取 `get(values, name)` 后先过 `toControl`。
- `components/SchemaForm.tsx` / `SchemaFields.tsx`：新增 `converters` prop 并向下传；`SchemaForm` 从 rest 中解构掉，避免透传给 antd `<Form>`。
- `core/validate.ts`：校验未知 id 与 `converter + valueType` 冲突。
- `index.tsx`：导出 `FieldConverter`、`ConverterContext`。
- README：增加一段 `converters` 用法与边界说明。

实现细节上，`getValueFromEvent` 接收的是控件原始事件参数，需要先提取为控件值（优先沿用 widget 已有的提取逻辑，否则按 antd 默认规则取 `target.value` / `checked` / 首参），再交给 `toStore`。

## 测试

- `money`：初始 1999 → 控件 19.99；输入 20.5 → store 2050；`null` 透传。
- `percent`：0.15 ↔ 15。
- `json`：合法 JSON 字符串回显对象；对象写回字符串；坏字符串不抛错、原样回显。
- 上下文读取：`currency` 变化后，本字段的 `toControl` 结果随之变化。
- 视图态：`viewMode` 下 span 显示 `toControl` 后的值。
- 互斥与校验：`converter + valueType` 报错；未知 id 报错；`itemProps.getValueProps` 覆盖 converter。
- 回归：不传 `converters` 时 128 条既有用例全过。

## 规模

- 新增 2 个类型、1 个核心文件，约 120 行实现；改 4 个入口文件、1 个校验函数。
- 不动 widget 层、condition、presets。
- 预计新增 12–15 条测试。

## 后续（不在本期）

跨字段派生单独设计，放在 `SchemaForm` 层：`derive({ changedKeys, values, meta }) => patch`，由 `onValuesChange` 触发，只跑一次、不递归、不支持异步，`patch` 不得包含本次变更的键。等真实业务样例确认后再立项，不塞进 converter 的返回值。
