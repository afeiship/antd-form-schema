# 字段级 converter 设计（converters）

日期：2026-11-21

## 先回答：有没有必要

**有必要，但要把「值转换」和「派生字段」拆开，MVP 只做前者。**

支持做的理由：

1. 现在要做到「金额分转元」「百分比存小数」「对象与 JSON 字符串互转」「标签数组与逗号串互转」，只能在 `itemProps` 里手写 `getValueProps` / `getValueFromEvent`。这要求使用者懂 antd / rc-field-form 的内部约定，写出来的转换散落在各业务组件里，不能复用、不好测试。
2. `valueType` 只服务日期类 widget，无法承载业务语义，也不适合继续往里堆类型。
3. `normalizeValues` 是整表提交前的单向收口，管不了「回显时把存储值变成控件值」这一半，也不适合按字段复用。
4. 但「一个 converter 既转换本字段、又顺手生成别的字段」会把纯函数变成带副作用的状态写入：渲染期改表单值容易触发循环、顺序依赖、异步竞态。这个能力不该塞进 converter 的返回值里。

因此结论是：

- **做**：`converters` 注册表 + 字段 `converter: '<id>'`，每个 converter 提供双向、纯函数的单字段值转换。
- **不做（本阶段）**：converter 直接往表单写衍生值。跨字段派生先由表单级 `normalizeValues` 或调用方 `onValuesChange` 承担；若后续确有强需求，再单独立项（见文末 P2 草案）。

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

## P2 草案：派生值（本阶段不实现）

如果业务确实需要「改 A 自动算 B」，推荐的形状不是让 converter 返回 patch，而是表单级显式声明：

```ts
<SchemaForm
  meta={meta}
  converters={converters}
  derive={(values, changedKeys) => ({
    total: values.price * values.qty,
  })}
/>
```

约束：只在 `onValuesChange` 后执行一次；返回的键不得包含本次变更的键；派生结果不再触发 derive（单层）；异步派生不支持。这样能避免 converter 变成隐式状态机，也便于调用方控制循环。是否要做，等真实业务样例再定。

## 规模

- 新增 2 个类型、1 个核心文件、约 120 行实现；改 4 个入口文件、1 个校验函数。
- 不动 widget 层、不动 condition、不动 presets。
- 预计新增 12–15 条测试。
