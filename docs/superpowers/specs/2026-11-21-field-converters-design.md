# 字段级 converter 设计（converters）

日期：2026-11-21

## 一句话边界

**converter 是「字段值适配器」：读整张表单，只写本字段。**

这句话是这份文档的总纲。`ctx.values` 会给整表快照，所以 converter 可以看别的字段来决定自己怎么显示、怎么存；但它的返回值只作用于当前字段，不能借返回值去更新 `total`、`fullName` 之类的其他 key，也不能调用 `form.setFieldsValue`。

| 行为 | 是否允许 | 说明 |
| --- | --- | --- |
| 读 `ctx.values` 做换算/判断 | 允许 | 结果是本字段的显示值或存储值 |
| 写回本字段的存储值 | 允许 | 只有 `toStore` 的返回值 |
| 返回时顺手改别的字段 | 不允许 | 这是表单派生，不是字段适配 |
| 在 converter 里调 form API | 不允许 | 纯函数约束 |
| 改 A 自动生成 B | 不在本特性 | 由表单级 `derive`（P2）或 `normalizeValues` 承担 |

## 先回答：有没有必要

**有必要，但要把「值转换」和「派生字段」拆开，MVP 只做前者。**

支持做的理由：

1. 现在要做到「金额分转元」「百分比存小数」「对象与 JSON 字符串互转」「标签数组与逗号串互转」，只能在 `itemProps` 里手写 `getValueProps` / `getValueFromEvent`。这要求使用者懂 antd / rc-field-form 的内部约定，写出来的转换散落在各业务组件里，不能复用、不好测试。
2. `valueType` 只服务日期类 widget，无法承载业务语义，也不适合继续往里堆类型。
3. `normalizeValues` 是整表提交前的单向收口，管不了「回显时把存储值变成控件值」这一半，也不适合按字段复用。
4. 但「一个 converter 既转换本字段、又顺手生成别的字段」会把纯函数变成带副作用的状态写入：渲染期改表单值容易触发循环、顺序依赖、异步竞态。这已经越过了「字段值适配器」的边界。

因此结论是：

- **做**：`converters` 注册表 + 字段 `converter: '<id>'`，每个 converter 提供双向、纯函数的值转换；可以读整表 values，只影响本字段。
- **不做（本阶段）**：converter 直接往表单写衍生值。跨字段派生先由表单级 `normalizeValues` 或调用方 `onValuesChange` 承担；若后续确有强需求，再单独立项（见文末 P2 设计）。

## 用法（拍板形状）

converter 放独立注册表，字段只引用 id，保持 schema 可序列化（YAML / JSON / DB 里存的 meta 不需要带函数）。

```ts
// converters.ts
import type { FieldConverter } from '@jswork/antd-form-schema';

export const converters: Record<string, FieldConverter> = {
  // 存储：分（整数）；控件：元（两位小数）
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
// 组件层透传
<SchemaForm meta={meta} converters={converters} presets={presets} />
// SchemaFields / useFormSchema 同名参数，优先级一致
```

```ts
// hook 层
useFormSchema(meta, form, { converters, presets, locale });
```

## converter 契约

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
  /** 存储值 → 控件值（回显）。缺省时原样透传。 */
  toControl?: (value: any, ctx: ConverterContext) => any;
  /** 控件变更值 → 存储值（写回）。缺省时原样透传。 */
  toStore?: (value: any, ctx: ConverterContext) => any;
}
```

约束：

- 两个函数都必须是**纯函数**：不调 `form.setFieldsValue` / `setState`，不发请求，不读外部可变状态。
- `values` 是渲染或事件发生时的快照。converter 可以读别的字段做决策（比如按币种换算），但不能改它。
- `undefined` / `null` 由 converter 自己决定怎么处理，库不预先短路；这样 `null → '-'`、`'' → undefined` 之类也能表达。
- 抛错时：dev 下 `console.warn` 并回退原值，不让表单崩；production 静默回退。与现有 widget 校验的处理风格一致。

允许与禁止的典型写法：

```ts
// 允许：读 currency 决定 amount 的显示单位，返回值仍只给 amount
currencyAmount: {
  toControl: (value, ctx) =>
    value == null ? value : ctx.values.currency === 'USD' ? value / 100 : value,
  toStore: (value, ctx) =>
    value == null ? value : ctx.values.currency === 'USD' ? Math.round(value * 100) : value,
},
```

禁止的写法：在 converter 里调 `form.setFieldsValue`，或者设计一个「返回 patch 让库写别的 key」的返回值。`ConverterContext` 不提供 form 实例，也不存在 patch 语义——需要派生字段就走 P2 的 `derive`。

一句话判断标准：**一次 converter 只回答「这个字段现在该显示什么 / 该存什么」，不回答「表单还应该变成什么」。**

## 与现有机制的优先级

1. **字段 `converter` > 全局无转换**：字段写了才生效，不写零开销、零行为变化。
2. **与 `valueType` 互斥**：`valueType` 已被日期 widget 占用（dayjs / string / timestamp / number），再叠一层 converter 会让「谁先谁后」无法解释。开发期校验报错：`converter "x" cannot be combined with valueType on field "y"`。
3. **不接管 options / rules / required / placeholder / itemProps**：converter 只碰值。`itemProps` 里显式写的 `getValueProps` / `getValueFromEvent` 仍然优先于 converter（显式逃生舱最后赢）。
4. **视图态同样生效**：`viewMode` 下控件值来自 `get(values, name)`，展示前先过 `toControl`，`span` 才能显示人类可读值而不是存储原值。
5. **提交值以 store 为准**：`SchemaForm.onFinish` 拿到的是转换后的存储值；再叠加 `normalizeValues` 的整表处理。两者职责不同：converter 管单字段双向，`normalizeValues` 管整表收口。

## 实现落点

- `core/types.ts`：新增 `FieldConverter`、`ConverterContext`、`UseFormSchemaOptions.converters`、`FieldSchema.converter?: string`。
- `core/converters.ts`：`resolveConverter(id, registry)` + `applyFieldConverter(field, converter, values, meta)`，负责生成 `itemProps` 上的 `getValueProps` / `getValueFromEvent`。无 converter 时返回原 itemProps，保证零回归。
- `useFormSchema.ts`：在 `applyConverter`（widget 层）之后套业务层；`BoundField` 新增 `converter?: string` 便于调试。
- `components/SchemaForm.tsx` / `SchemaFields.tsx`：新增 `converters` prop 并向下传；`SchemaForm` 记得从 rest 中解构掉，避免透传给 antd `<Form>`。
- `core/validate.ts`：校验未知 converter id、`converter + valueType` 冲突；未知 id 在 dev 下抛错，风格与 `unregistered widget` 一致。
- 导出类型：`FieldConverter`、`ConverterContext`。

## 非目标

- 不做嵌套字段路径的批量转换（`items[].price` 这类留给业务层）。
- 不做异步 converter（远程换算、汇率请求）。异步应在取详情或提交前完成。
- 不做 converter 内直接改别的字段（见 P2）。
- 不做 YAML 直接写函数；YAML 里只能写 converter id。

## 测试计划

- `money`：初始 1999 → 控件 19.99；输入 20.5 → store 2050；`null` 透传。
- `json`：合法 JSON 字符串回显为对象；输入对象写回字符串；坏字符串不抛错、原样回显。
- `percent`：0.15 ↔ 15。
- 视图态：`viewMode` 下 span 显示 `toControl` 后的值。
- 优先级：字段 `itemProps.getValueProps` 覆盖 converter；`converter + valueType` 触发校验错误；未知 id 触发校验错误。
- 回归：不传 `converters` 时 128 条既有用例行为不变。

## P2 设计：表单级 derive（本阶段不实现）

### 定位

`converter` 与 `derive` 是两层，不互相替代：

- **converter**：字段适配器。回答「这个字段的存储值和控件值怎么互换」，只写本字段，可读整表。
- **derive**：表单派生。回答「某个字段变了，另外哪些字段要跟着变」，由表单层统一调度。

把派生塞进 converter 的返回值，会让一个纯函数同时承担「本字段转换」和「跨字段写入」两种语义，循环与顺序问题无法在字段层解决。因此派生单独设计。

### API 形状

```ts
export interface DeriveContext {
  /** 本次变化涉及的顶层 key */
  changedKeys: string[];
  /** 变更后的整表 values */
  values: Record<string, any>;
  meta: FormSchema;
}

/** 返回要写回的字段补丁；不返回或返回空对象表示无需派生。 */
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

只挂在 `SchemaForm` 这一层：它天然拥有 `Form` 实例，能在 `onValuesChange` 里安全写值。headless 使用者继续用自己的 `onValuesChange`，不强制走这个 API。

### 执行规则

1. **只在交互事件里跑**：由 antd `Form.onValuesChange` 触发，绝不在渲染期执行。
2. **一批变更只跑一次**：`changedKeys` 取自 `changedValues` 的顶层 key；同一批多次输入合并为一次派生。
3. **写回方式**：`form.setFieldsValue(patch)`，不触发校验，不重置 touched。
4. **防循环**：`patch` 的 key 不得与 `changedKeys` 相交；由 derive 引发的这次写入不再触发 derive（一次性 guard，可用 ref 或标记位实现）。违反时 dev 下 `console.warn` 并丢弃冲突键。
5. **单层派生**：派生结果不递归触发下一轮 derive；需要多级计算时在一次 `derive` 内算完。
6. **同步 only**：返回 Promise 不支持；异步换算应在取数或提交前完成。
7. **与 `normalizeValues` 的分工**：`derive` 在交互过程中维护联动值，`normalizeValues` 只在 `onFinish` 前做一次整表收口。

### 测试计划（P2）

- `price*qty → total`：修改 price 后 total 更新，且 total 自身修改不触发 derive。
- 同一批修改 price 与 qty，derive 只执行一次。
- patch 含 `changedKeys` 中的键时被丢弃并告警。
- 派生写值不触发校验错误、不改变其他字段 touched 状态。
- 不传 `derive` 时零行为变化（回归）。

### 非目标（P2）

- 不做跨表单派生。
- 不做异步/远程派生。
- 不做多级链式依赖图（先单层，真实样例足够再升级）。

## 规模

- MVP：新增 2 个类型、1 个核心文件、约 120 行实现；改 4 个入口文件、1 个校验函数。
- P2：`SchemaForm` 增加一个 `derive` prop 与 guard，约 40 行；不动 converter 核心。
- 不动 widget 层、不动 condition、不动 presets。
- MVP 预计新增 12–15 条测试，P2 另加 5–6 条。
