# 表单部件 Slots 设计

> 日期：2026-11-20
> 状态：已批准（builder check 返回「nothing important left」；用户授权无需等待、直接开发，2026-11-20）
> 基线：`docs/superpowers/specs/2026-11-20-schema-form-design.md` + `docs/requirements/002-final-prd.md`

## 意图与原因

`SchemaFields` / `SchemaForm` 解决了样板问题，但字段结构是写死的：`grid div > item div > label + control div > Form.Item`，校验错误由 antd `Form.Item` 内部渲染。`className` 只能改样式，换不掉结构、也插不进自定义内容（label 旁加 tooltip、控件旁加单位、错误用自定义文案）。用户希望像 `@jswork/react-list` 那样，把表单的核心部件做成 slots。

## 目标

- 在 `SchemaFields` / `SchemaForm` 上加 `slots` prop，四个部件可替换：`label` / `field` / `control` / `error`。
- slot 三形态直接复用 `@jswork/react-list` 的 `Slot<P>` 与 `renderSlot`：组件、ReactNode、`{component, props}`。
- 不提供 slot 时，行为与当前完全一致（开箱即用不退化）。
- 不动 headless 核心（`useFormSchema` / BoundField / 纯函数 / widgets）。

## 非目标 / 反目标

- 不把整个字段做成一个 slot（那是退回 headless，用户已选部件级）。
- 不把 grid 容器做成 slot（className 已够，且和 grid class 职责重叠）。
- 不自己实现 slot helper（用户明确要求：能引进 `@jswork/react-list` 就引进）。
- 不改 Schema 数据契约；slots 是组件 props，不进 Schema。

## 约束

- 依赖：`@jswork/react-list` 加到 lib 的 `dependencies`（它导出 `renderSlot` / `isSlotConfig` / `Slot`；发布版 2.0.18 在 npm 可用）。React 仍是 peer。
- antd 只在渲染层 import，核心纯函数无 antd 运行时依赖。
- `renderSlot` 的三形态语义：**运行时 props 覆盖 slot 配置的默认 props**，ReactNode 原样渲染，undefined 返回 null。
- 代码标识符、注释、提交信息用英文；文档中文。

## 方案取舍

**A. 部件级 slots（已选，用户确认「按推荐方式」）**：`slots={{ label, field, control, error }}`，每槽有默认实现，只替换需要的。好处：仍是「一行出活」，按需定制一个部件即可；调用方不用重写整套字段渲染。

**B. 字段级 slot（slots.item）**：一个 slot 拿整个 `BoundField` 自行渲染 label+控件+错误。否决：等于退回 headless，丢掉便捷层价值。

## 已拍板的设计

1. **依赖**：`pnpm --filter @jswork/antd-form-schema add @jswork/react-list`；从包根 import `renderSlot`、`isSlotConfig`、`Slot` 类型。不引入 `ReactList` 组件本身（本库不用列表）。
2. **slot 类型与上下文**：
   ```ts
   type FieldCtx = { field: BoundField };
   interface FormSlots {
     label?: Slot<FieldCtx>;
     field?: Slot<FieldCtx & { children: ReactNode }>;
     control?: Slot<FieldCtx & { control: ReactNode; itemProps: FormItemProps }>;
     error?: Slot<FieldCtx & { errors: string[] }>;
   }
   ```
   `Slot` / `renderSlot` 来自 `@jswork/react-list`。各槽收到的 `field` 是 `useFormSchema` 产出的完整 `BoundField`。
3. **默认实现**：
   - `label`：现有 `<label className={labelClassName}>{field.label}{required && ' *'}</label>`
   - `field`：现有 `<div className={itemClassName}>{children}</div>`
   - `control`：现有 `<div className={controlClassName}><Form.Item {...itemProps}>{control}</Form.Item></div>`
   - `error`：见第 5 条（错误渲染接管）
4. **渲染流程**（`SchemaFields` 内，按 react-list 的 `renderSlot` 模式）：
   ```tsx
   const view = slots?.field
     ? renderSlot(slots.field, { field, children: <DefaultFieldBody/> }, field.key)
     : <DefaultFieldBody/>;
   ```
   `DefaultFieldBody` 依次 `renderSlot(slots?.label, { field })`、`renderSlot(slots?.control, { field, control, itemProps })`、`renderSlot(slots?.error, { field, errors })`。className 系列 props 只喂给默认实现；自定义 slot 用自己的 class。
5. **错误渲染接管**：为让 `error` slot 拿到 errors 且保证 reactive，控件区改为：
   - `<Form.Item {...itemProps} noStyle>{control}</Form.Item>`（只做值绑定，不出错文案）
   - 再叠一个 `<Form.Item noStyle shouldUpdate>{() => renderSlot(slots.error ?? DefaultError, { field, errors: form.getFieldError(field.name) })}</Form.Item>`
   - **不提供 `error` slot 时也必须可见错误**：默认 `DefaultError` 渲染错误文案（等价于 antd 默认展示效果）。这是行为等价约束，不能因为接管导致错误消失。
   - 该改动只影响 `SchemaFields` 渲染层；`itemProps` 仍只含数据键。
6. **props 传递**：`SchemaFieldsProps` / `SchemaFormProps` 都加 `slots?: FormSlots`；`SchemaForm` 把 `slots` 透传给 `SchemaFields`。className 系列保持现状。
7. **重导出**：`FormSlots` 类型从 lib 根 named 导出；`Slot` 类型由 `@jswork/react-list` 提供，lib 不重复定义。
8. **example / README**：新增一个 slots demo（自定义 label 加 tooltip、自定义 error、自定义 control 加单位），README 增加 slots 一节并说明「只替换需要的部件」。

## 实现者仍需自行决定的细节（本设计的调用）

1. **文件位置**：slots 类型与默认渲染放 `packages/lib/src/slots.tsx`（新文件），`SchemaFields.tsx` 调用；测试放 `__tests__/09-slots.spec.tsx`。
2. **默认错误的样式**：用简单的 `<div role="alert">{errors.join(', ')}</div>`，不引 antd 样式类；测试只断言文案出现，不锁 class。
3. **shouldUpdate 的写法**：用 `Form.Item` 的 `shouldUpdate` render prop 读 `form.getFieldError(field.name)`；若 antd 对无 `name` 的 Form.Item 有额外要求，以实现者验证为准，保持「提供/不提供 error slot 都可见错误」的约束。
4. **viewMode 下的 slots**：查看态复用同一 slot 流程，slot 收到的 `field.control` 已是查看态控件；`error` slot 在查看态通常无 errors（遵循现状）。
5. **mutation 测试**：新增 slot 时至少验证「自定义 label 生效、未提供的 control 仍是默认控件」；错误 slot 验证「自定义 error 收到 errors 数组」。

## 交付与验收

- `pnpm test` 全绿（新增 slot 测试覆盖三形态、默认不退化、错误可见、props 透传）。
- `pnpm build` 四种产物正常；CJS/ESM named export 含 `FormSlots`。
- example 站新增 slots demo，dev server 可访问。
- 用户可在浏览器确认：只换 label 时其余部件不变；自定义 error 能拿到错误数组。

## 留待用户的问题

无。方向（部件级 slots）、slot 三形态、引入 `@jswork/react-list` 均已确认；其余按上述调用执行。builder check 若提出问题再单独带来。
