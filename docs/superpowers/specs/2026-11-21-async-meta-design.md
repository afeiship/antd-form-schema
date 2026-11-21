# meta 异步形态设计

日期：2026-11-21

## 意图

SchemaForm/SchemaFields 的 `meta` 常来自接口。当前只支持同步 `FormSchema`，数据晚到时 antd 非受控 `initialValues` 灌不进去。本设计让 `meta` 接受 Promise，库内处理 loading 与填充。

## 用法（拍板形状）

```tsx
const [asyncMeta] = useState(() => fetchMeta()); // Promise<FormSchema>
<SchemaForm meta={asyncMeta} />                  // 内部 loading → resolve → 自动填充
```

## 方案对比

- **A：effect 灌值** — meta.initialValues 引用变化时 `setFieldsValue`。有"冲掉用户输入 vs 竞态"的边界问题，需要脏检查守卫。
- **B：用户手写样板** — 文档教 `useEffect(() => form.setFieldsValue(data))`。每个使用方重复写。
- **C：延迟挂载（选定）** — meta 为 Promise 时先渲染 loading 占位，resolve 后才挂载 `<Form>`。initialValues 在挂载时同步传入，天然避开 antd 非受控限制，无竞态无脏检查。

## 目标

- `SchemaForm` / `SchemaFields` 的 `meta` 支持 `FormSchema | Promise<FormSchema>`。
- 未 resolve 渲染 `loading?: ReactNode` 占位（默认 antd `<Spin>`）。
- reject 渲染 `error?: ReactNode` 占位（默认 null）。
- 同步 meta 行为完全不变。

## 非目标 / 反目标

- 不管请求本身（fetch/缓存/重试/取消归业务）。
- `useFormSchema` hook 不支持异步（Form 未挂载即无 hook 场景；hook 用户自管数据）。
- 不做 schema 片段渐进 resolve。

## 实现要点

- `SchemaFields.tsx`：`meta: FormSchema | Promise<FormSchema>`；内部 `useState`（resolved meta / error）+ `useEffect` resolve。注意 Promise 是 prop、每次渲染可能是新引用 → effect 依赖用 prop 本身，用 cancelled 标志防过期 resolve。
- `SchemaForm.tsx`：复用同一 resolve 逻辑（抽小 hook `useResolvedMeta`，放 `src/core/` 或组件目录内），未就绪时不渲染 `<Form>`，直接渲染占位。
- 占位 props：`loading?: ReactNode`（默认 `<Spin />`）、`error?: ReactNode`（默认 null）。
- 类型更新 `SchemaFieldsProps` / `SchemaFormProps`。
- README 一行说明。

## 测试

1. 同步 meta：行为不变（现有 108 测试保证）。
2. Promise resolve 后渲染字段并应用 initialValues。
3. pending 时渲染 Spin 占位、不渲染 `<form>`。
4. reject 时渲染 error 占位（自定义 ReactNode）。
5. prop 引用变化（新 Promise）：以最后者为准，无泄漏告警。

## 规模

小改动（~60 行 + 测试）。直接走 writing-plans。
