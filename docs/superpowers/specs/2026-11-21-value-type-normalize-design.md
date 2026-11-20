# 值类型转换（valueType）与 normalizeValues 设计

日期：2026-11-21

## 背景与动机

`date-picker` / `date-time` 字段经 antd Form 收集后，`onFinish` 拿到的值是 dayjs 对象。业务提交前不得不做二次转化（format / valueOf）。目标：让 schema 能声明"表单里最终存的值是什么类型"，声明一次、全库生效；同时提供一个整包收尾的命令式出口。

## 目标

- 字段级 `valueType`：声明单字段值的类型，date 类 widget 内部完成转换。
- Meta 级 `normalizeValues`：提交前整包转换，命令式兜底。
- 保持向后兼容：不写任何新配置时行为不变（值即 dayjs 对象）。

## 非目标 / 反目标

- 不引入非 antd 5.14+ 的兼容层（用户使用最新版 antd）。
- 不做基于值类型的自动校验规则生成（rules 仍由用户显式声明）。
- 不改变 `initialValues` 的语义（仍是 passthrough，见 BoundField 注释）。

## 方案对比

### 方案 A：valueType 进 FieldSchema（选定）

在 `FieldSchema` 增加 `valueType` 与 `valueFormat`，date 类 widget（date-picker / date-time，及用户自定义注册走同一机制的）据此包装 DatePicker 的 `valueFormat` / onChange。

- 优点：声明式、可序列化，与 schema 定位一致；可被 `validateMeta` 检查（未知 valueType 报 warning）。
- 取舍：需处理数组值（range 场景）；自定义 widget 想复用需自己接。

### 方案 B：只加 normalizeValues 出口（同时采纳，作为兜底）

- 优点：零智能、最简单。
- 取舍：单字段类型仍需手写转换，问题只挪位置，不解决。故仅作兜底层。

### 方案 C：全局 dateToString 开关（否决）

- 粒度太粗，同表单混合"日期字符串 + 时间戳"时无法表达。

## 设计

### 1. valueType（FieldSchema 一等公民）

```ts
/** Form-level value type of a date field; default 'dayjs' keeps current behavior. */
valueType?: 'dayjs' | 'string' | 'number' | 'timestamp';
/** Format override, only meaningful when valueType is 'string'. Default 'YYYY-MM-DD'. */
valueFormat?: string;
```

映射规则（仅 date 类 widget 消费）：

- `dayjs`（默认）：不处理，值 = dayjs 对象。
- `string`：DatePicker 加 `valueFormat`（默认 `'YYYY-MM-DD'`，可被 `valueFormat` 覆盖）。
- `timestamp` / `number`：onChange 包装，存 `dayjs(value).valueOf()`；回显时 Form 内部值 → dayjs 的反向包装。

`BoundField` 增加 `valueType` / `valueFormat` 透传；转换发生在 widget 渲染层（`widgets/index.tsx` 的 date converter），Form 值即最终值，无需提交前处理。

### 2. normalizeValues（FormSchema + 组件 prop 双入口）

```ts
// FormSchema
normalizeValues?: (values: Record<string, any>) => Record<string, any>;

// SchemaForm / SchemaFields 也接受同名 prop，prop 优先于 meta。
```

- `SchemaForm`：包装 `onFinish`，提交时 `normalizeValues(values)` 后再传给用户的 onFinish。
- 外部 Form + `SchemaFields` 用法：库无法拦截 onFinish，由用户自行调用（或经 hook 暴露）；文档说明即可。

### 3. 职责边界

- `valueType`：单字段、声明式，管"form 里存什么"。
- `normalizeValues`：整包、命令式，管"提交前最后一步"（剔除空值、合并、单位换算等跨字段活）。

## 留给实现者的决定

- timestamp 回显反向包装的具体实现位置（widget 内部 vs bind 层），以最小侵入为准。
- `validateMeta` 对未知 `valueType` 给 warning（与现有 issue 机制一致）。
- 测试：valueType 各分支 + normalizeValues 双入口，风格随 `__tests__` 现有 spec。
