# hidden 字段属性设计

日期：2026-11-21

## 意图

部分字段不渲染、用户不可编辑，但值需保留并随表单提交（配置驱动的隐形字段）。当前 `condition` 管显隐且值随显隐丢弃，无法表达"纯携带值"。

## 方案对比

- **A：`hidden: true` 字段属性（选定）** — 声明式、与 `condition` 正交：`condition` 管"按状态显隐"（值跟随丢弃），`hidden` 管"永不渲染、值保留"。
- **B：normalizeValues 兜底** — 提交前手动 merge。能用但每处手写，不声明式。

## 语义

```ts
{ key: 'company', widget: 'input', hidden: true }  // 不渲染，但值保留并提交
```

- 永不渲染（不出现在 `visibleFields`、不产出 Form.Item）
- `initialValues` 中的值保留在 store，出现在 `onFinish`
- 与 `condition` 同时存在时：`hidden` 优先（永不渲染）
- `BoundField.visible === false`；新增 `BoundField.hidden === true` 供使用方识别

## 目标 / 非目标

- 目标：hidden 字段值进 store、进 onFinish；不渲染任何 UI。
- 非目标：不做"hidden 但显示为只读行"的混合形态；不动 `condition` 语义。

## 实现要点

- `core/types.ts`：`FieldSchema.hidden?: boolean`；`BoundField.hidden?: boolean`。
- `useFormSchema.ts`：`visible` 计算加 `field.hidden ? false : ...`；BoundField 透传 `hidden`。**关键**：值要进 store，字段必须注册——渲染层跳过即可，store 值来自 `initialValues`，无需 Form.Item 挂载也能随 `getFieldsValue` 提交（rc-field-form 对未注册字段不进 onFinish，**需验证**：探针显示未注册字段值确实不进 onFinish —— 所以实现必须让 hidden 字段的值进入 form store；方案：`SchemaForm`/hook 挂载时对 hidden 字段 `form.setFieldValue(name, initialValue)`，或渲染一个隐藏注册的 Form.Item（`hidden` 属性 antd 5 原生支持 `<Form.Item hidden>`，零成本）。选后者：`<Form.Item hidden>` 原生渲染但 DOM 隐藏，值注册、校验、提交全部正常，实现最薄）。
- 渲染层（`SchemaFields.tsx`）：hidden 字段渲染 `<Form.Item {...itemProps} hidden>`（antd 原生隐藏），不出现在 `visibleFields` 但保留在 `fields` 供提交。
- README 一行说明。

## 测试

1. `hidden: true` 字段：不出现在 DOM（无 `.ant-form-item` 非 hidden 元素），值出现在 onFinish。
2. `initialValues` 提供 hidden 字段值 → onFinish 含该值。
3. `hidden` 与 `condition` 同时存在：hidden 优先，不渲染。
4. 同步路径行为不变（现有测试保证）。

## 规模

小改动（~30 行 + 测试）。直接走 writing-plans。
