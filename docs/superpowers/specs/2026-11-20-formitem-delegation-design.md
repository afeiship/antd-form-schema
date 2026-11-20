# 委托 antd Form.Item 渲染 label / 必填星号 / 错误

> 日期：2026-11-20
> 状态：已批准（用户明确选择「全部交给 Form.Item」，2026-11-20）
> 基线：`docs/superpowers/specs/2026-11-20-form-slots-design.md`

## 意图与原因

当前 `FormFields` / `SchemaFields` 自己写 `<label>` + `<Form.Item noStyle>`，label 没有正确的 `htmlFor`，点击 label 不会聚焦控件；校验错误也由自己渲染，出现 `aria-describedby` 指向空元素等问题。用户要求：label、必填星号、错误文案全部交给 antd `Form.Item` 原生渲染——它自带 `htmlFor`、`required` 星号、错误展示。

## 已拍板的设计

1. **库渲染器**：`FormFields` 与 `SchemaFields` 默认路径改为 `<Form.Item {...itemProps} label={label}>{control}</Form.Item>`，**不再 `noStyle`**，不再手写 `<label>`，不再手写 error div。上一轮加的 `fieldDomId` / `withFieldId` 移除。
2. **slots 调整**（精简，公共 API 变更）：
   - `label`：覆盖 `Form.Item` 的 `label` **内容**（ReactNode，由 renderSlot 产出），antd 仍负责外层 `<label htmlFor>` 与星号。
   - `control`：覆盖 `Form.Item` 的 children（必须返回单个可接收 antd 注入 id 的元素）。
   - `field`：覆盖整项外层容器。
   - `error`：**移除**（antd 原生处理）。
3. **className**：`className`（grid 容器）、`itemClassName`（每项外层）保留；`labelClassName` 作为 antd label 内部 span 的 class，`controlClassName` 作为 `Form.Item` 的 className。
4. **example 全部改造**：basic-grid / custom-widget / view-edit / conditional-form / step-form 等手写 demo 一律改成 `<Form.Item {...field.itemProps} label={field.label}>{field.control}</Form.Item>`。card-groups 已是此形态。
5. **修 `options=""` 污染 DOM**：`useFormSchema` 创建默认控件时从传给组件的 props 中剔除 `options`（`BoundField.controlProps.options` 仍保留给自造控件使用）。

## 非目标
- 不改 `BoundField` / `itemProps` 数据契约；不改核心纯函数。
- 不重新引入手写 label/id/error 渲染。

## 验收
- 点击 label 聚焦输入框（浏览器原生行为；单测断言 antd label 的 htmlFor 指向控件 id）。
- 必填星号与错误文案由 antd 渲染；提交空必填可见错误。
- 三个 slot（label/control/field）可覆盖；error slot 移除。
- 控件 DOM 不再出现 `options=""`。
- `pnpm test` / `pnpm build` / example build 全绿。
