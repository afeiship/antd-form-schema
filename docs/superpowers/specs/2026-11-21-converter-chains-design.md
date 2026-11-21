# 字段 converter 链式组合设计

日期：2026-11-21
状态：待评审
关系：扩展 `2026-11-21-field-converters-design.md`，不改动单 converter 的既有语义。

## 意图

单个 converter 已经能处理「分 ↔ 元」「小数 ↔ 百分数」这类一对一换算，但真实字段经常需要多步转换：

- 金额：分 → 元 → 固定两位小数；
- 百分比：小数 → 百分数 → 带 `%` 后缀；
- JSON 字段：字符串 → 对象 → 只读摘要；
- 业务字段：先做单位换算，再按币种做一次显示适配。

这些逻辑拆成独立 converter 后更可复用，但字段只能引用一个 id。本特性让一个字段按顺序经过多个 converter。

## 一句话边界

**融合规则由配置顺序决定：`read` 从左到右，`write` 从右到左。**

不引入方向标记、不做条件分支、不把多个 converter 合并成新的注册表项。

## 配置形状

### 字段级

`FieldSchema.converter` 从 `string` 扩展为 `string | string[]`：

```ts
const meta: FormSchema = {
  fields: [
    // 单 converter：行为与现在完全一致
    { key: 'amount', widget: 'number', converter: 'money' },

    // 链式：读从左到右，写从右到左
    { key: 'price', widget: 'number', converter: ['money', 'fixed2'] },
  ],
};
```

### 表单级默认

`FormSchema.converters` 的 value 同样支持数组：

```ts
const meta: FormSchema = {
  converters: {
    price: ['money', 'fixed2'],
    discount: 'percent',
  },
  fields: [{ key: 'price' }, { key: 'discount' }],
};
```

优先级不变：

```ts
const chain = field.converter ?? meta.converters?.[field.key];
```

1. 字段 `converter` 整体覆盖表单级配置，不做拼接。
2. 字段没有配置时才使用 `meta.converters[key]`。
3. 两者都没有 → 不转换，零回归。
4. 空数组 `[]` 等同于未配置。

### 注册表

converter 实现仍在 `SchemaForm` / `SchemaFields` / `useFormSchema` 的 `converters` 注册表里，key 是 id，value 仍是单个 `FieldConverter`。链式只发生在引用侧，注册表不接收数组。

## 执行语义

配置：

```ts
converter: ['a', 'b', 'c']
```

读方向：

```text
storedValue
  → a.read(value, ctx)
  → b.read(value, ctx)
  → c.read(value, ctx)
  → control value
```

写方向：

```text
control value
  → c.write(value, ctx)
  → b.write(value, ctx)
  → a.write(value, ctx)
  → stored value
```

即：数组顺序描述的是「存储 → 控件」的自然顺序；写回必须逆序，才能还原。

### 每一步的输入输出

- 上一步的返回值就是下一步的入参，不额外包一层结构。
- 所有步骤共享同一份 `ConverterContext`：
  - `ctx.values` 仍是进入本次转换前的整表快照，不因链中某一步的返回值而变化；
  - `ctx.field` / `ctx.meta` 不变；
  - 仍然只读，不允许调用 form API，不允许写别的字段。
- 不对 `null` / `undefined` 做统一短路，由每个 converter 自己决定是否透传。

### 示例

```ts
const money: FieldConverter = {
  read: (value) => (value == null ? value : Number(value) / 100),
  write: (value) => (value == null ? value : Math.round(Number(value) * 100)),
};

const fixed2: FieldConverter = {
  read: (value) => (value == null ? value : Number(value).toFixed(2)),
  write: (value) => (value == null || value === '' ? value : Number(value)),
};

const converters = { money, fixed2 };
```

配置 `['money', 'fixed2']`：

| 阶段 | 值 |
| --- | --- |
| 存储 | `1999` |
| `money.read` | `19.99` |
| `fixed2.read` | `"19.99"` |
| 用户输入 | `"20.50"` |
| `fixed2.write` | `20.5` |
| `money.write` | `2050` |

## 可逆性约束

链式写回依赖每一步都能反向执行。规则：

1. 链长度大于 1 时，链中每个 converter 必须同时实现 `read` 与 `write`。
2. 缺少 `write` 的 converter 只允许单独使用（例如只读展示字段）。
3. 违反第 1 条时，开发期给 warning：`converter "x" in chain "a,b" has no write`，不阻断渲染；生产环境静默按「缺省即透传」执行。
4. 不校验数学意义上的严格互逆；是否可逆由使用方负责，文档写明约束。

理由：如果链中某一步只读，写回时会跳过它，后续步骤拿到的值形态已经不对，容易静默写坏数据。警告能提示，但不强制阻止「只读字段 + 只读链」的合理场景。

## 校验

沿用 `validateMeta`，按「生效后的链」校验：

1. 逐个 id 检查是否注册；任一未注册 → error，dev 抛 `unregistered converter "x"`。
2. 链非空且字段有 `valueType` → error：`converter "a,b" cannot be combined with valueType on field "key"`。
3. 链长度大于 1 且存在缺 `write` 的成员 → warning（见上）。
4. 空数组不参与上述任何校验。
5. 表单级 `meta.converters` 中出现未注册 id，只在对应字段生效时报告，避免未使用配置产生噪音。

## 优先级（在既有规则上追加）

1. 字段 `converter` 整体覆盖 `meta.converters[key]`。
2. 链内顺序不可被注册表或组件层改写。
3. `itemProps` 显式 `getValueProps` / `getValueFromEvent` 仍然最后赢，直接绕过整条链。
4. `converter` 链与 `valueType` 互斥。
5. 视图态只执行 `read` 方向，不挂 `write`。
6. widget 自己的 `applyConverter` 先执行，业务 converter 链在后。

## 错误处理

- 整条链包在同一个 try/catch 中，不做「保留部分结果」。
- `read` 链抛错：回退到该字段的原始存储值用于展示。
- `write` 链抛错：回退到本次事件的原始控件值，保持现状「不阻断表单」。
- dev 下 `console.warn` 一次，消息包含字段 key、完整链和失败的 id：

```text
[antd-form-schema] converter chain "money,fixed2" failed at "fixed2" on "price"
```

- production 静默回退。

## 类型改动

```ts
export interface FieldSchema {
  /** 单个 id 或按顺序执行的 id 链 */
  converter?: string | string[];
}

export interface FormSchema {
  /** 表单级默认：字段 key -> 单个 id 或 id 链 */
  converters?: Record<string, string | string[]>;
}

export interface BoundField {
  /** 实际生效的 id 或 id 链，便于调试 */
  converter?: string | string[];
}
```

`FieldConverter` 本身不变。

## 实现要点

- 新增 `resolveConverterChain(idOrIds)`：统一把 `string | string[] | undefined` 归一为 `string[]`，过滤空数组。
- `applyFieldConverter` 接收 `FieldConverter[]`：
  - `read`：正向 `reduce`；
  - `write`：`[...converters].reverse()` 后 `reduce`；
  - 单元素数组与现在的单 converter 路径等价。
- `readConvertedValue` 同样走正向链。
- `useFormSchema` 解析生效链，`BoundField.converter` 返回原配置形态（string 或 array），不强制展开。
- `validateMeta` 按生效链逐项校验，并生成缺 `write` 的 warning。
- 组件层无需新增 prop，`converters` 注册表保持原样。

## 测试

- 单 converter 字符串：既有 money 用例全部保持通过。
- 链式读：`['money', 'fixed2']`，1999 → `"19.99"`；调用顺序为 money → fixed2。
- 链式写：输入 `"20.50"` → 2050；调用顺序为 fixed2 → money（用 spy 验证逆序）。
- 空数组：不转换，store 与控件一致。
- 字段链覆盖 `meta.converters` 的单 id 或链。
- `meta.converters` 使用数组时正常生效。
- 链中未知 id：dev 抛错。
- 链与 `valueType` 同时出现：报冲突错误。
- 链长 > 1 且成员缺 `write`：产生 warning，渲染不失败。
- 链中某一步抛错：回退原始值，dev 只 warn 一次。
- 视图态：只执行 `read` 链，span 显示最终值。
- `itemProps.getValueProps` 存在时绕过整条链。
- 回归：全量既有测试通过。

## 非目标

- 不支持链内条件分支（按 values 选择不同 converter）。
- 不支持每一步单独指定方向。
- 不支持字段链与表单级链自动拼接。
- 不支持把数组直接写进注册表作为别名。
- 不支持异步 converter。
- 不支持嵌套字段路径（`items[].price`）的链式转换。
- 不改 `valueType`、`normalizeValues`、widget `applyConverter` 的职责。

## 兼容性

- 现有 `converter: 'money'` 配置完全不变。
- 现有 `meta.converters` 只支持字符串，扩展为联合类型属于向后兼容。
- `BoundField.converter` 类型扩宽，读取方需要处理数组。
- 无新增 prop，无新增导出。

## 规模

- 改 3 个核心文件：`types.ts`、`converters.ts`、`useFormSchema.ts`。
- 改 1 个校验文件：`validate.ts`。
- 新增约 10 条测试，README 增加「链式」小节。
- 不动组件层、widget 层、presets、condition。

## 未决问题

1. 链抛错时，回退「整条链的原始输入」还是「最后一次成功的结果」？当前建议前者，语义简单且可预测。
2. 缺 `write` 的成员目前建议 warning；如果团队更希望严格，可升级为 error。
3. 是否需要限制链长度（例如最多 3 个）？当前不限制，交由使用方。
