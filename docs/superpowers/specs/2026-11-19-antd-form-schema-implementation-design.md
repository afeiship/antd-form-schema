# antd-form-schema 实现设计

> 日期：2026-11-19
> 状态：已获批准（用户回答问题 1=透传不接管、2=严格按 PRD，2026-11-19）
> 需求基线：`docs/requirements/002-final-prd.md`（PRD v1.0，FINAL）

## 意图与原因

`@jswork/antd-form-schema` 当前是一个脚手架空壳：一个带 `className` 的 div 组件和 5 个针对它的测试。PRD 要求把它重写为 **headless 的 antd 表单 schema 绑定库**——Schema 只描述字段语义（控件标识、数据、文案、校验、条件），不描述布局与样式；库只产出「数据绑定 + 默认控件 + 可见性」，渲染 100% 交还使用者的 JSX + Tailwind。

做这件事的原因：配置式表单库用 `columns`/`gutter`/`colSpan` 描述 UI，永远追不上代码（Tailwind）的表现力；把 UI 交还给使用者后，同一份可序列化 Schema 可以用于 grid、卡片、折叠面板、分步表单，而库只保留 tiny 的数据绑定核心。

## 目标

- `useFormSchema(meta, form, options?)` 为主 API，named export；产出 `fields` / `visibleFields` / `getField` / `issues`。
- `BoundField` 提供纯数据的 `itemProps`（name/rules/valuePropName/dependencies/shouldUpdate）与 `control` / `controlProps` / `WidgetComponent` / `viewContent`，无任何布局或样式键。
- 声明式 `condition` + `Form.useWatch` 自动联动；函数型 condition 用 `watch` 显式逃生。
- 查看/编辑模式（表单级 + 字段级），enum 显示 label。
- 内置 WIDGETS 表 + 局部 `widgets` 覆盖 + 直接给组件的逃生舱；无 Adapter / 全局注册 / 单例。
- `validateMeta` named export；dev 期自动校验并暴露 `issues`。
- `FormFields` 便捷渲染器 + default export 别名（兼容脚手架现状），无布局 props。
- 产物：`index.mjs` / `index.cjs` / `index.d.ts` / `style.css`（空样式兼容位）。

## 非目标 / 反目标

- 不做跨 UI 库适配、Adapter、全局配置。
- 不做布局引擎、栅格配置键、主题/样式系统。
- 不接管 Form 实例、状态管理与提交流程。
- 不重造 antd 的 `dependencies` / `shouldUpdate` / 校验器。

反目标（做出来也算失败）：Schema 里出现任何布局/样式键；库产出 DOM 栅格；全局 widget 注册导致多实例互相干扰。

## 约束

- pnpm workspace：`packages/lib`（主库）+ `packages/example`（Vite + Tailwind demo）。构建 tsup，测试 vitest + @testing-library/react（jsdom，globals）。
- React 18 +，peerDependency。
- antd >= 5 新增为 peerDependency；devDependencies 里也要装 antd，供测试与类型构建解析。
- classnames 保留 peerDependency，仅用于 `FormFields` 的 className 合并。
- 核心纯函数不得 import antd 运行时；antd 只在 widgets 映射层 import。
- 代码标识符、注释、提交信息用英文；对话与设计文档用中文。
- 不推送远程；git 提交信息英文。

## 方案取舍

**A. 按 PRD 第 12 节阶段表逐阶段 TDD**：先纯函数测试，再 widgets，再 hook 联动，再查看态，最后 FormFields + example。每阶段有明确退出标准，问题最早暴露；节奏偏慢。

**B. 先一次性打通全链路出可跑 demo，再回头补测试（已选）**：一口气把 lib 全部模块按 PRD 落地并让 example 站跑起来，用户可立即在浏览器里看到效果；随后补单测覆盖 PRD 第 12 节各退出标准。优势是「可跑的东西」最早出现，代价是条件监听与查看态这类边界问题会在集成后暴露，需要在补测试阶段集中修正。

选 B 的理由：本仓库是空壳、没有历史兼容负担，PRD 已把全部设计决策拍死；先把系统跑通能让用户在真实页面里纠正偏差，比先写单测更省返工。A 被否决。

## 已拍板的设计（来自 PRD，实现时不得动摇）

- 三层职责：Schema 纯数据 → headless 核心（纯函数 + 唯一 hook）→ 使用者渲染层。库的边界停在第二层。
- `widget` 保留字符串 id / React 组件双形态；字符串查内置 WIDGETS 或 hook 的 `widgets` 局部表；`resolveWidget` 遇到组件直接返回。
- `key` 推导 name：默认按 `.` 拆成 NamePath；`!!!` 前缀强制不拆；显式 `name` 优先。
- `options` 三形态归一为 `NormalizedOption[]`；由 widget 的 `metaConverter` 转成控件 props / children。
- `required: true` 在 normalize 时转成 required rule；`rules` 原样透传。
- `normalizeMeta` / `validateMeta` / `collectWatchPaths` / `evaluateCondition` 为纯函数；`useFormSchema` 是唯一碰 hook 的入口，内部 `useWatch` 只用于触发重渲染，取值走 `form.getFieldValue()`。
- 条件比较符 `eq/ne/gt/gte/lt/lte/in/nin/empty/notEmpty/includes`，递归 `and/or/not`；函数型 condition 依赖 `watch: NamePath[]`。
- 查看态：`itemProps.valuePropName = 'initialValue'`；`viewWidget` 默认 `span`，enum 显示 label；字段级 `viewMode` 覆盖表单级。
- 隐藏与卸载交给渲染层：`visibleFields` 卸载字段，使用者自己加 `hidden` class 保留值。
- 字段级 `initialValue` 仅作为 passthrough 数据：`BoundField.initialValue` 原样带出，**不放进 `itemProps`**，hook 不调用 `form.setFieldsValue`、不维护本地 values 副本（透传不接管）。自动初始化只通过 `meta.initialValues` → `<Form initialValues>` 由使用者完成；需要默认值时，使用者在渲染自己的 `Form.Item` 时自行消费 `field.initialValue`（例如传给 antd `Form.Item` 的 `initialValue`）。

## 实现者仍需自行决定的细节（本设计的调用）

1. **文件结构**：按 PRD 第 12 节拆分 `types.ts` / `normalize.ts` / `condition.ts` / `bind.ts` / `validate.ts` / `widgets.tsx` / `useFormSchema.ts` / `FormFields.tsx` / `utils.ts`；`index.tsx` 作为入口。不引入额外抽象层。`FieldSchema.readOnly` 无独立 BoundField 字段，并入 `controlProps.readOnly`。
2. **测试替换**：`__tests__/01-basic.spec.tsx` 的 5 个 div 组件测试整体替换；新增测试按 PRD 第 12 节退出标准组织（normalize、condition、widgets、hook 联动、view/edit、FormFields）。vitest 需加 setup 文件 mock `matchMedia` / `ResizeObserver`（antd 组件在 jsdom 下必需）。
3. **构建配置**：tsup/vitest 配置结构不改，但必须修一个现有 bug——`tsup.config.ts` 的 CJS footer `module.exports = module.exports.default` 会让 `require(pkg).useFormSchema` 为 undefined，与 PRD 的 named + default 导出冲突；改为把 default 挂到 `module.exports.default` 上或去掉 footer。antd 加进 lib 的 peerDeps + devDeps，同时加进 example 的 deps；tsup 默认外部化 peer，无需改 external。example 冷启动时 workspace 包 `exports` 只指向 `dist/*`，需在 `packages/example/vite.config.ts` 加 alias 指向 `packages/lib/src/index.tsx`，避免必须先 build。
4. **example 示例站**：PRD 6.1 列出的 Basic Grid / Card Groups / Custom Widget / View-Edit / Conditional / 分步表单全部以 `div` + Tailwind 实现；`form-list` widget 首期可不做，分步表单用条件显隐 + 多段 JSX 演示即可，不引入 `Form.List`。
5. **antd 细节验证（最小 spike，编码第一步先做）**：`useWatch(paths, form)` 数组形式在 antd 5 下能否订阅多路径触发重渲染；查看态 `valuePropName='initialValue'` 配合 span 控件能否正常显示值。裸 DOM `<span>` 不消费 `initialValue`，需实现 `ViewSpan` 读 `initialValue` + `options` 显示 label（多选按 `, ` 拼接）；自定义 `viewWidget` 组件需同样消费 `initialValue`。若 spike 与预期不符，调整实现并在本文件记录结论，不回退 PRD 决策。
6. **validateMeta 行为**：签名 `validateMeta(meta, widgets?) => Issue[]`，`Issue={level:'error'|'warning',message,field?,index?}`。dev 期全部收进 issues + `console.warn`；仅「widget 未注册」在 dev 抛出，生产降级为 input。其他细节：`rules` 非法 = 非数组或元素非对象；dev 判定 `process.env.NODE_ENV !== 'production'`；`eq/ne` 严格相等，`gt..lte` 先转数值再退化字符串比，`in/nin` 检查值∈候选数组，`includes` 是数组型字段包含操作数，`empty` = null/undefined/''/[]/{}（0/false 不算空）；`condition.field` 为字符串含点号时复用 key 推导；函数型 condition 用 `form.getFieldsValue(true)` 取 values，缺 `watch` 时 dev warn；`collectWatchPaths` 递归 and/or/not；`viewContent` 每次 render 按当前值重算。widget 合并顺序：schema 原值 → metaConverter → 局部 widgets 覆盖；`radio` 单控件按 checked 处理；直接传组件的逃生舱默认 `valuePropName='value'`。
7. **meta 元数据（用户已定）**：`FormSchema.name/version` 仅元数据；`initialValues` 与表单级 `disabled` **透传不接管**——hook 不调用 `form.setFieldsValue`，不碰 form 状态；表单级 `disabled` 作为字段默认值（字段级优先），`initialValues` 仅作为数据带出，由使用者自行传给 `<Form initialValues>`。default export **严格按 PRD** 改成 `FormFields` 别名，同步重写 example 与 README，接受破坏性变更。

## 交付与验收

- `pnpm test` 全绿，`pnpm build` 产出四种文件。
- `pnpm dev` 起 example 站，Basic Grid / Conditional / View-Edit / 分步表单等示例可在浏览器里操作。
- 总体验收：用本库替换一个真实业务表单，布局/样式 100% 由 div + Tailwind 完成，Schema 中无任何布局键（本仓库以 example 站作为等价演示）。

## 用户已确认的取舍（已并入设计）

- `meta.initialValues` / 表单级 `meta.disabled`：**透传不接管**——hook 不碰 form 状态；disabled 作为字段默认值（字段级优先），initialValues 由使用者自行传给 `<Form>`。
- default export：**严格按 PRD** 改成 `FormFields` 别名，同步重写 example 与 README，接受破坏性变更。
