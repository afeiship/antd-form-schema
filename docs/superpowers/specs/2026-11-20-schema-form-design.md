# SchemaForm 便捷层设计

> 日期：2026-11-20
> 状态：已批准（用户确认 form 内部创建、初值只用 meta、校验错误可见、拆成两个组件；“ok”确认设计，2026-11-20）
> 基线：`docs/requirements/002-final-prd.md`（PRD v1.0）+ `docs/superpowers/specs/2026-11-19-antd-form-schema-implementation-design.md`

## 意图与原因

当前库把「headless」当成唯一使用场景，普通表单也必须写全套样板：`Form.useForm()` → `useFormSchema` → `<Form>` → `map(visibleFields)` → 每层 `div` + `label` + 星号 + `<Form.Item {...itemProps}>{control}</Form.Item>`。用户在 jsw-admin 项目里用第三方库的体验是：一份 meta + 一行组件就出活，定制再下钻。用户希望本库也提供这种分层——**保留 headless 核心，在其上加一层开箱即用的渲染组件**。

目标体验（两个组件，用户已确认拆分，共用同一套字段渲染逻辑）：

```tsx
// 1) 简单场景：一行出活，Form 由组件内部创建
<SchemaForm
  meta={meta}
  onFinish={handleSubmit}
  className="grid grid-cols-2 gap-4"
  itemClassName="..."
  labelClassName="..."
  controlClassName="..."
/>

// 2) 需要控制 form 时用 SchemaFields（字段渲染器，放进外部 <Form>）
<Form form={form} onFinish={handleSubmit}>
  <SchemaFields meta={meta} className="grid grid-cols-2 gap-4" />
  <Button htmlType="submit">提交</Button>
</Form>
```

`SchemaForm` 内部 `Form.useForm()` + 渲染 `SchemaFields`；`SchemaFields` 是纯字段渲染器，从 `FormProvider` 上下文拿 form（`Form.useFormInstance()`），不接收 `form` prop。初值**只取 `meta.initialValues`**（用户已确认），由 `SchemaForm` 传给内部 `<Form initialValues>`；`SchemaFields` 场景由使用者的外部 `<Form>` 自行负责初值（保持 antd 原生语义）。布局列数由 `className`（Tailwind grid）控制，Schema 仍不含布局键；className props 只是把「使用者本来要写的 JSX class」提到了组件 props，样式决定权仍在使用者手里。

## 目标

- 新增 named export `SchemaForm`：内部创建 `Form` 实例，传 `meta` 即一行渲染出带 label、必填星号、校验绑定的表单；需要手动操作时用 `onFormReady(form)` 拿实例。
- 新增 named export `SchemaFields`：字段渲染器，通过 `Form.useFormInstance()` 从上下文取 form，放进使用者的外部 `<Form>` 即可，不接收 `form` prop。
- 两个组件共享同一套字段渲染实现（内部抽一个共用函数/组件，不放进公开 API）。
- 用 className props 暴露布局控制点：容器、单项、label、控件容器四类；默认不假设列数，单列纵向。
- 复用现有 `useFormSchema`，零重复逻辑；条件显隐、widget 覆盖、查看态、options 归一化全部沿用。
- 提交只做 `onFinish` 透传，不接管数据加载/HTTP/后端约定。
- 保留 `useFormSchema` / `FormFields` / default 全部现有导出，不破坏现有消费者。

## 非目标 / 反目标

- 不做资源表单（不提供 `name` → 自动 CRUD、不引入 HTTP 依赖）——这是被否决的 B 方案。
- 不在 Schema 里重新引入 `columns`/`gutter`/`colSpan` 等布局键——仍由 className + Tailwind 决定。
- 不修改 headless 核心的任何纯函数与 hook 行为。
- 不内置主题、不做视觉设计；`colorPrimary` 之类的样式交给 antd ConfigProvider 与 Tailwind。

## 约束

- pnpm workspace；lib 源码 tsup 构建四种产物；vitest + RTL 测试。
- antd 仅在 widget 层与渲染组件层 import；核心纯函数保持无 antd 运行时依赖。
- Schema 仍零布局 / 零样式键；className props 在组件层，不进 Schema。
- `itemProps` 仍只含数据绑定键，`label` 由 SchemaForm 自己渲染。
- 代码标识符、注释、提交信息用英文；文档中文。

## 方案取舍

**A. 加一层 `SchemaForm` + `SchemaFields` 渲染组件（已选）**：`SchemaFields` = `useFormSchema` + className 布局 + label/星号/Form.Item 薄封装；`SchemaForm` = 内部 Form + `SchemaFields`。`FormFields` 保留原样作为更底层的便捷器。代价：PRD §5.3 的「便捷渲染器无布局 props」被放宽到新组件上，但 Schema 契约不变。

**B. 全包资源表单**：给 `name` 就自动加载/提交，接近 jsw-admin 的 `ReactAntResourceFormFc`。否决：引入 HTTP 与 admin 业务假设，偏离 tiny 定位，用户已在讨论中确认只做 A。

## 已拍板的设计

1. **API 形态**：
   ```ts
   interface FieldRenderProps {
     meta: FormSchema;
     widgets?: Record<string, WidgetDef>;
     className?: string;        // 字段列表容器 div
     itemClassName?: string;    // 每个字段外层 div
     labelClassName?: string;
     controlClassName?: string;
   }

   interface SchemaFormProps extends Omit<FormProps, 'form' | 'children'>, FieldRenderProps {
     onFormReady?: (form: FormInstance) => void;
     children?: ReactNode;      // 追加在字段之后（如提交按钮）
   }

   // SchemaFields 即 FieldRenderProps，不含 FormProps/onFormReady/children
   ```
   `SchemaForm` 内部 `Form.useForm()` 创建（用户已确认），`onFormReady` 作为逃生舱在挂载时回调实例。**初值只取 `meta.initialValues`**（用户已确认），`SchemaForm` 传给内部 `<Form initialValues={meta.initialValues}>`，不提供 `initialValues` prop；`SchemaFields` 场景初值由使用者的外部 `<Form>` 负责。

2. **className 控制点与 DOM 结构**（必须按此树实现，否则 grid 不生效）：
   - `SchemaFields` 渲染字段列表本体：
   ```tsx
   <div className={className}>                      {/* grid 容器 */}
     {visibleFields.map(f => (
       <div className={itemClassName} key={f.key}>    {/* 每项 */}
         <label className={labelClassName}>{f.label}{f.required && ' *'}</label>
         <div className={controlClassName}>           {/* 控件容器 */}
           <Form.Item {...f.itemProps}>{f.control}</Form.Item>  {/* 无 noStyle：校验错误可见 */}
         </div>
       </div>
     ))}
   </div>
   ```
   - `SchemaForm` 包一层内部 Form：
   ```tsx
   <Form form={form} initialValues={meta.initialValues} {...rest}>
     <SchemaFields {...fieldProps} />
     {children}                                       {/* 提交按钮等，在 grid 之后 */}
   </Form>
   ```
   校验错误可见是用户已确认的决策：`Form.Item` **不带 `noStyle`**。默认单列纵向；`className="grid grid-cols-2 gap-4"` 即两列。
3. **重导出**：`SchemaForm` 与 `SchemaFields` 均为 named export；`FormFields` 与 default 保持现状不动。
4. **不碰核心**：`useFormSchema`、`BoundField`、纯函数、widget 表全部不改。两个组件只调用它们。
5. **查看态 / 条件 / 局部 widget**：透传 `widgets` 给 hook；`visibleFields` 驱动渲染；viewMode 沿用 Schema 与 field 级设置。

## 实现者仍需自行决定的细节（本设计的调用）

1. **文件位置**：新建 `packages/lib/src/SchemaFields.tsx`（共享字段渲染）与 `packages/lib/src/SchemaForm.tsx`（Form 包装），在 `index.tsx` 加两个 named export；测试放 `__tests__/08-schema-form.spec.tsx`。
2. **Form props 透传范围**：`{...rest}` 透传给 antd `Form`（含 `onFinish`、`layout` 等），但 `form`/`initialValues`/`children` 已显式处理，不从 rest 重复传入。
3. **onFormReady 时机**：用 effect 在挂载后回调一次（或 ref 保证只调用一次），避免每次 render 重复触发。
4. **example**：新增一个 demo 分区同时展示一行式 `SchemaForm` 与外部 form 的 `SchemaFields`（与现有 Basic Grid 并存）。
5. **文档**：lib README 增加 `SchemaForm` / `SchemaFields` 一节，说明取舍与 className 控制点。

## 交付与验收

- `pnpm test` 全绿（新增测试覆盖：`SchemaFields` 的 className 透传、条件显隐、label/星号、viewMode；`SchemaForm` 内部建 form、`meta.initialValues` 自动生效、`onFormReady` 回调、校验错误可见、children 追加在 grid 之后）。
- `pnpm build` 产出四种文件；CJS/ESM named export 含 `SchemaForm` 与 `SchemaFields`。
- example 站新增一行式 demo，dev server 可访问。
- 用户可在浏览器确认：简单场景一行出活，复杂场景仍可用原 hook 或 SchemaFields。

## 留待用户的问题

无。方向（A）、两个组件拆分（用户中途确认）、内部 form + `onFormReady`、初值只用 meta、校验错误可见、className 控制——全部已确认。Builder check 的三个问题已并入设计；第 4 项（form 归属确认）也已被用户中途改口并落实。
