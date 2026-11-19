# antd-form-schema Headless 库 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `@jswork/antd-form-schema` 从空壳 div 组件重写为 headless 的 schema→antd 表单绑定库，并交付一个可操作的 Vite/Tailwind 示例站。

**Architecture:** Schema 是纯数据契约（零布局/零样式），`useFormSchema` 是唯一 hook 入口，编排 normalize / condition / bind / validate 纯函数与 WIDGETS 映射，产出 `BoundField[]`（`itemProps` + `control` + `visible`）。DOM、栅格、样式 100% 交还使用者的 JSX。antd 只在 widgets 层 import，核心纯函数无 antd 运行时依赖。

**Tech Stack:** pnpm workspace、TypeScript、React 18、antd 5、tsup（ESM/CJS/d.ts/style.css）、vitest + @testing-library/react + jsdom、Vite 8 + Tailwind 3。

**Spec:** `docs/superpowers/specs/2026-11-19-antd-form-schema-implementation-design.md`（及其基线 `docs/requirements/002-final-prd.md`）

## Global Constraints

- npm 包名 `@jswork/antd-form-schema`；仓库 `afeiship/antd-form-schema`。
- Schema 零布局 / 零样式键；库不产出 DOM 栅格；无 Adapter / 全局注册 / 单例。
- React 18+ peerDependency；**新增 antd >= 5 peerDependency**；classnames 保留 peerDependency（仅 `FormFields` 使用）。
- 构建产物：`dist/index.mjs`、`dist/index.cjs`、`dist/index.d.ts`、`dist/style.css`；CJS 的 named export 必须可用。
- 导出：named `useFormSchema` / `FormFields` / `validateMeta` / 类型；default `AntdFormSchema` = `FormFields` 别名（破坏性变更，同步重写 example 与 README）。
- `meta.initialValues` / 表单级 `meta.disabled` **透传不接管**：hook 不调用 `form.setFieldsValue`；disabled 作为字段默认值（字段级优先），initialValues 由使用者传给 `<Form>`。
- `itemProps` 只含 `name` / `rules` / `valuePropName` / `dependencies` / `shouldUpdate`；**刻意不含 `label` 与任何 className/style**。
- 代码标识符、注释、提交信息用英文；对话与设计文档用中文；包管理器 pnpm；不推送远程。
- `.superpowers` 已加入 `.gitignore`。

## Review Focus

1. **被条件隐藏字段的值保留**：`visibleFields` 从 DOM 卸载后，`form.getFieldValue()` 仍应返回原值（antd `preserve` 默认行为）→ 在 `05-hook.spec.tsx` 加测试。
2. **`!!!` 前缀字段名的端到端一致性**：`key:'!!!a.b'` 必须在 normalize、条件订阅、`Form.Item name` 三处都按字面 `a.b` 处理，不能某个环节拆成嵌套路径 → `02-normalize.spec.ts` + `05-hook.spec.tsx`。
3. **查看态 enum 显示 label 且不碰 form 状态**：viewMode 下应显示选项 label 而非原始 value，且 hook 不得写入 form → `06-view-mode.spec.tsx`。
4. **未知 widget 生产降级**：生产环境下未注册 widget 必须降级为 Input 而不是崩溃 → `04-widgets.spec.tsx`。
5. **CJS named export 可用**：当前 `tsup.config.ts` 的 CJS footer 会吃掉 named export，`require(pkg).useFormSchema` 必须存在 → Task 1 的构建烟测验证。

---

## File Structure

```
packages/lib/src/
├── index.tsx          # named/default 导出，default = FormFields
├── types.ts           # FormSchema / FieldSchema / BoundField / Condition / WidgetDef / Issue
├── utils.ts           # get / has / uniqPaths / normalizeOptions / toNamePath / resolveName
├── widget-ids.ts      # BUILTIN_WIDGET_IDS 纯数据常量（无 antd import）
├── normalize.ts       # normalizeMeta
├── condition.ts       # evaluateCondition / collectWatchPaths
├── bind.ts            # getItemProps / getControlProps
├── widgets.tsx        # WIDGETS 表 + resolveWidget + ViewSpan + metaConverter
├── useFormSchema.ts   # 唯一 hook
├── FormFields.tsx     # 便捷渲染器
├── style.css          # 保留空样式兼容位
└── globals.d.ts       # 现有 __VERSION__ 声明
packages/lib/vitest.setup.ts          # matchMedia / ResizeObserver mock
packages/lib/__tests__/01-basic.spec.tsx → 重写为 FormFields/default 测试
packages/lib/__tests__/02-normalize.spec.ts
packages/lib/__tests__/03-condition.spec.ts
packages/lib/__tests__/04-widgets.spec.tsx
packages/lib/__tests__/05-hook.spec.tsx
packages/lib/__tests__/06-view-mode.spec.tsx
packages/lib/__tests__/07-validate.spec.ts
packages/example/src/
├── app.tsx            # 示例站入口，分区展示 6 个 demo
├── meta.ts            # 共享 FormSchema 示例
└── components/
    ├── basic-grid.tsx
    ├── card-groups.tsx
    ├── custom-widget.tsx
    ├── view-edit.tsx
    ├── conditional-form.tsx
    └── step-form.tsx
```

---

### Task 1: 依赖、构建与测试脚手架修复

**Files:**
- Modify: `packages/lib/package.json`
- Modify: `packages/example/package.json`
- Modify: `packages/lib/tsup.config.ts`
- Modify: `packages/lib/vitest.config.mts`
- Create: `packages/lib/vitest.setup.ts`
- Modify: `packages/example/vite.config.ts`

**Interfaces:** Produces: 可运行的 `pnpm install` / `pnpm build` / `pnpm test` 基线；antd 可被 lib 与 example 解析；vitest 加载 `vitest.setup.ts`；CJS named export 不再被 footer 吞掉。

- [ ] **Step 1: 补 antd 依赖**

在 `packages/lib/package.json` 的 `peerDependencies` 加 `"antd": ">=5"`，`devDependencies` 加 `"antd": "^5"`；在 `packages/example/package.json` 的 `dependencies` 加 `"antd": "^5"`。运行 `pnpm install`。

预期：`pnpm install` 成功退出，无 antd 缺失警告。

- [ ] **Step 2: 修 CJS footer 与 example alias**

删除 `packages/lib/tsup.config.ts` 中 `footer: (...) => ...` 整段（当前 `module.exports = module.exports.default` 会让 named export 丢失）。在 `packages/example/vite.config.ts` 的 `defineConfig` 中加：
```ts
resolve: { alias: { '@jswork/antd-form-schema': resolve(__dirname, '../lib/src/index.tsx') } },
```
并 `import { resolve } from 'node:path'`。目的是新克隆无 `dist` 时 dev server 也能跑。

- [ ] **Step 3: 加 vitest setup mock**

创建 `packages/lib/vitest.setup.ts`：用 `vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }))` 与等价的 `ResizeObserver` 空实现 mock。在 `packages/lib/vitest.config.mts` 的 `test` 配置加 `setupFiles: ['./vitest.setup.ts']`。**不要**改其他配置结构。

- [ ] **Step 4: 验证基线**

Run: `pnpm --filter @jswork/antd-form-schema test && pnpm --filter @jswork/antd-form-schema build`
预期：现有 5 个 div 测试全部 PASS；build 产出 4 种文件且无报错。读取 `packages/lib/dist/index.cjs` 末尾，确认不存在 `module.exports = module.exports.default`。

- [ ] **Step 5: Commit**

`git add packages/lib/package.json packages/example/package.json packages/lib/tsup.config.ts packages/lib/vitest.config.mts packages/lib/vitest.setup.ts packages/example/vite.config.ts && git commit -m "chore: add antd deps and fix build/test scaffolding"`

---

### Task 2: 类型与纯函数内核（types / utils / normalize / condition / bind / validate）

**Files:**
- Create: `packages/lib/src/types.ts`、`utils.ts`、`widget-ids.ts`、`normalize.ts`、`condition.ts`、`bind.ts`、`validate.ts`
- Test: `packages/lib/__tests__/02-normalize.spec.ts`、`03-condition.spec.ts`、`07-validate.spec.ts`

**Interfaces:**
- Consumes: Task 1 的 antd 类型与 vitest setup。
- Produces:
  - `types.ts`: `Widget`, `OptionInput`, `NormalizedOption`, `FieldSchema`, `FormSchema`, `CompareOp`, `CompareCondition`, `LogicCondition`, `Condition`, `ConditionFn`, `WidgetDef`, `UseFormSchemaOptions`, `BoundField`, `Issue`, `UseFormSchemaResult`，以及 re-export 的 `NamePath` / `FormInstance` / `FormItemProps` / `Rule`。
  - `utils.ts`: `get(values: any, path: NamePath): any`、`has(values: any, path: NamePath): boolean`、`uniqPaths(paths: NamePath[]): NamePath[]`、`normalizeOptions(options?: OptionInput[]): NormalizedOption[]`、`toNamePath(key: string): NamePath`、`resolveName(field: FieldSchema): NamePath`。
  - `widget-ids.ts`: `BUILTIN_WIDGET_IDS: string[]`（14 个内置 id 的纯数据常量，无 antd import）。
  - `normalize.ts`: `normalizeMeta(meta: FormSchema): NormalizedMeta`，其中 `NormalizedField = FieldSchema & { name: NamePath; options: NormalizedOption[]; rules: Rule[]; disabled: boolean }`，`NormalizedMeta = Omit<FormSchema,'fields'> & { fields: NormalizedField[] }`。
  - `condition.ts`: `evaluateCondition(condition: Condition | ConditionFn, ctx: { form: FormInstance; values: Record<string, any> }): boolean`、`collectWatchPaths(fields: FieldSchema[]): NamePath[]`、`getConditionPaths(condition: Condition): NamePath[]`。
  - `bind.ts`: `getItemProps(field: NormalizedField, extras?: { valuePropName?: string; dependencies?: NamePath[]; shouldUpdate?: FormItemProps['shouldUpdate'] }): FormItemProps`、`getControlProps(field: NormalizedField, extras?: Record<string, any>): Record<string, any>`。
  - `validate.ts`: `validateMeta(meta: FormSchema, widgets?: Record<string, WidgetDef>): Issue[]`，`Issue = { level: 'error'|'warning'; message: string; field?: string; index?: number }`。

- [ ] **Step 1: 写失败测试（normalize）**

创建 `02-normalize.spec.ts`，包含：
```ts
it('splits dotted key into NamePath', ... expect(resolveName({ key: 'user.name' })).toEqual(['user','name']));
it('keeps !!!-prefixed key literal', ... expect(resolveName({ key: '!!!a.b' })).toEqual(['a.b']));
it('prefers explicit name over key', ...);
it('normalizes three option shapes', ... 字符串 → {value:'Apple',label:'Apple'}；[value,label] → 对应对象；对象原样保留 disabled/key);
it('converts required to rule', ... expect(normalizeMeta({fields:[{key:'x',required:true}]}).fields[0].rules).toEqual([{required:true}]));
it('keeps explicit rules and appends required', ...);
it('defaults widget to input and disabled from form level', ... meta.disabled=true 且 field 不写 → disabled=true；field.disabled=false 覆盖 → false);
it('defaults options to empty array', ...);
```
运行 `pnpm --filter @jswork/antd-form-schema test -- 02-normalize`，确认 FAIL（模块不存在）。

- [ ] **Step 2: 写失败测试（condition）**

创建 `03-condition.spec.ts`，包含：
- 11 个比较符各一条断言（eq/ne 用严格相等；gt/gte/lt/lte 数值比较；in/nin 检查值在候选数组；empty 对 `null/undefined/''/[]/{}` 为真而 `0/false` 为假；notEmpty 取反；includes 检查数组字段包含操作数）。
- `and` / `or` / `not` 递归各一条。
- `collectWatchPaths` 递归收集 and/or/not 内字段路径并去重（含 `!!!` 前缀保留字面量）。
- 函数型 condition 收到 `form` 与 `values`（用假 form 对象 `{ getFieldsValue: () => ({role:'admin'}) } as any`）。

运行 `pnpm --filter @jswork/antd-form-schema test -- 03-condition`，确认 FAIL。

- [ ] **Step 3: 写失败测试（validate）**

创建 `07-validate.spec.ts`，按 PRD §5.4 逐条：fields 非数组 → error；key 缺失/重复 → error 含索引；widget 未注册 → error；condition.field 不存在 → warning；options 非数组 → error；rules 非法（非数组或元素非对象）→ warning；合法 meta → 空数组。运行确认 FAIL。

- [ ] **Step 4: 实现 types.ts**

按 Interfaces 字段清单定义全部类型。`FieldSchema` 字段严格按 PRD §4.1（含 `readOnly`、`viewWidget`、`watch`、`valuePropName` 等）；`FormSchema` 含 `name/version/viewMode/disabled/initialValues/fields`；re-export antd 的 `NamePath`（从 `antd/es/form/interface`）、`FormInstance`、`FormItemProps`、`Rule`。**不含任何布局/样式键。**

- [ ] **Step 5: 实现 utils.ts**

- `toNamePath(key)`: 以 `!!!` 开头则去掉前缀后作为**单元素数组**返回；否则按 `.` split。
- `resolveName(field)`: `field.name ?? toNamePath(field.key)`。
- `get(values, path)`: 支持 string / NamePath 数组逐层取值，任一层为空返回 undefined。
- `has`: 同上但判断路径是否存在（值为 undefined 视为不存在）。
- `uniqPaths`: 以 `JSON.stringify(path)` 去重。
- `normalizeOptions`: 字符串 → `{value:s,label:s}`；二元组 → `{value, label}`；对象原样保留；undefined → `[]`。

- [ ] **Step 5b: 实现 widget-ids.ts**

导出 `BUILTIN_WIDGET_IDS = ['input','text','password','textarea','number','date-picker','date-time','radio','radio-group','checkbox','switch','checkbox-group','select','span']`（仅纯数据，供 validate 与 widgets 测试共享，避免 validate 依赖 antd）。

- [ ] **Step 6: 实现 normalize.ts**

`normalizeMeta(meta)`: 对每字段取 `name = resolveName(field)`、`options = normalizeOptions(field.options)`、`rules = [...(field.required ? [{required:true}] : []), ...(Array.isArray(field.rules) ? field.rules : [])]`、`disabled = field.disabled ?? meta.disabled ?? false`、`widget = field.widget ?? 'input'`；其余字段原样带出。不修改入参。

- [ ] **Step 7: 实现 condition.ts**

`evaluateCondition` 按 Review Focus 与测试断言实现全部比较符与 `and/or/not` 递归；`getConditionPaths` 递归提取 CompareCondition 的 `field`（归一化成 NamePath）；`collectWatchPaths(fields)` = 对所有 `field.condition` 为声明式者取 `getConditionPaths`，对函数型者取 `field.watch ?? []`，`uniqPaths` 去重。函数型 condition 调用时传入 `ctx.form` 与 `ctx.values`。

- [ ] **Step 8: 实现 bind.ts**

`getItemProps` 只返回 `{ name: field.name, rules: field.rules, valuePropName: extras?.valuePropName, dependencies: field.dependencies ?? extras?.dependencies, shouldUpdate: field.shouldUpdate ?? extras?.shouldUpdate }`，过滤 undefined 键；**绝不返回 label / className / style**。`getControlProps` 返回 `{ options: field.options, placeholder: field.placeholder, disabled: field.disabled, readOnly: field.readOnly, ...field.widgetProps, ...extras }`。

- [ ] **Step 9: 实现 validate.ts**

按测试逐条实现；`widgets` 参数用于判断字符串 widget 是否注册，未注册表时用 `BUILTIN_WIDGET_IDS`（来自 `widget-ids.ts`）判断——为保证核心纯函数无 antd 运行时依赖，这里只查这个纯数据常量，不 import `widgets.tsx`。dev 与生产行为差异由 hook 处理，本函数只返回 issues。

- [ ] **Step 10: 运行测试**

Run: `pnpm --filter @jswork/antd-form-schema test -- 02-normalize 03-condition 07-validate`
预期：全部 PASS。

- [ ] **Step 11: Commit**

`git add packages/lib/src packages/lib/__tests__ && git commit -m "feat: add schema types and pure function core"`

---

### Task 3: Widget 系统与绑定组装（widgets.tsx）

**Files:**
- Create: `packages/lib/src/widgets.tsx`、`packages/lib/src/widget-ids.ts`
- Test: `packages/lib/__tests__/04-widgets.spec.tsx`

**Interfaces:**
- Consumes: Task 2 的 `WidgetDef` / `NormalizedField` / `normalizeOptions` / `toNamePath` / `getControlProps`；antd 控件。
- Produces:
  - `WIDGETS: Record<string, WidgetDef>`
  - `resolveWidget(widget: Widget | undefined, local?: Record<string, WidgetDef>): WidgetDef`
  - `applyConverter(field: NormalizedField, def: WidgetDef, meta: FormSchema): NormalizedField`
  - `ViewSpan: React.FC<{ initialValue?: any; options?: NormalizedOption[]; value?: any }>`

- [ ] **Step 1: 写失败测试**

创建 `04-widgets.spec.tsx`：
- 遍历 `BUILTIN_WIDGET_IDS` 中的每个 id，断言 `resolveWidget(id).component` 存在。
- `checkbox` / `switch` / `radio` 的 metaConverter 产出 `valuePropName === 'checked'`。
- `radio-group` / `checkbox-group` / `select` 的 converter 把 `options` 转成 children（渲染后断言 option 文本）。
- `date-time` 的 converter 写入 `widgetProps.showTime === true`。
- 局部 `widgets` 覆盖内置 `select`：`resolveWidget('select', { select: {component: MySelect} }).component === MySelect`。
- 直接给组件（非字符串）时 `resolveWidget(Rate)` 返回该组件本身。
- 未知字符串 widget：`resolveWidget('nope')` 回退到 input 定义。
运行确认 FAIL。

- [ ] **Step 2: 实现 widgets.tsx**

按 PRD §6.1 建表，`component` 为对应 antd 控件（`Input` / `Input.Password` / `Input.TextArea` / `InputNumber` / `DatePicker` / `Radio` / `Radio.Group` / `Checkbox` / `Switch` / `Checkbox.Group` / `Select` / `ViewSpan`）。`resolveWidget` 规则：非字符串直接 `{component: widget}`；字符串先查 `local[widget]`，再查 `WIDGETS[widget]`，最后回退 `WIDGETS.input`。`applyConverter` 合并顺序为 schema 原值 → `def.metaConverter?.(...)` → 局部覆盖已由 resolveWidget 完成；`widgetProps` 需浅合并而非整体替换。`ViewSpan` 从 `initialValue ?? value` 取值；若 `options` 存在则显示匹配 value 的 label（数组值按 `, ` 拼接），否则显示原始值（null/undefined 显示空）。antd 只在 `widgets.tsx` 顶层 import。

- [ ] **Step 3: 运行测试**

Run: `pnpm --filter @jswork/antd-form-schema test -- 04-widgets`
预期：全部 PASS。

- [ ] **Step 4: Commit**

`git add packages/lib/src/widgets.tsx packages/lib/__tests__/04-widgets.spec.tsx && git commit -m "feat: add built-in widget table and converters"`

---

### Task 4: useFormSchema hook（联动 + 显隐 + 查看态）

**Files:**
- Create: `packages/lib/src/useFormSchema.ts`
- Test: `packages/lib/__tests__/05-hook.spec.tsx`、`06-view-mode.spec.tsx`

**Interfaces:**
- Consumes: Task 2 全部纯函数、Task 3 的 `resolveWidget` / `applyConverter` / `ViewSpan`。
- Produces: `useFormSchema(meta: FormSchema, form: FormInstance, options?: UseFormSchemaOptions): UseFormSchemaResult`。

**关键实现决定（本设计的调用，已写死）：** antd 的 `Form.useWatch` 接收单个 `NamePath`，传二维数组语义不明确。hook 使用 **`Form.useWatch([], form)`（watch-all）** 订阅任意字段变化，保证联动触发；`collectWatchPaths` 仍作为纯函数导出/测试，供未来细粒度订阅使用。取值统一走 `form.getFieldsValue(true)`，避免闭包旧值。这符合 PRD「自动 useWatch 订阅」的决策，不回退到手写 `onValuesChange`。

- [ ] **Step 1: 写联动失败测试**

创建 `05-hook.spec.tsx`，渲染一个测试组件（用 `Form.useForm()` + `useFormSchema(meta, form)`），断言：
- 初始 `role='user'` 时 `company.visible === false`，`visibleFields` 不含 company。
- `form.setFieldsValue({role:'admin'})` 后 `company.visible === true`，`visibleFields` 含 company（无需 `onValuesChange`）。
- `getField('name')` 返回对应 BoundField；不存在的 key 返回 undefined。
- `itemProps` 只含数据键（断言不含 `label` / `className` / `style`）。
- `key:'!!!a.b'` 字段的 `itemProps.name === ['a.b']`，且 `form.getFieldValue(['a.b'])` 能读到值。
- 隐藏字段从 DOM 卸载后 `form.getFieldValue('company')` 仍保留原值。
- 函数型 condition 配合 `watch: ['role']` 能在 role 变化后重算 visible。
运行确认 FAIL。

- [ ] **Step 2: 写查看态失败测试**

创建 `06-view-mode.spec.tsx`：
- `meta.viewMode=true` 时所有字段 `viewMode === true`，`itemProps.valuePropName === 'initialValue'`，`f.control` 渲染出值文本。
- select 字段在 viewMode 下显示 option label 而非 value。
- 字段级 `viewMode:false` 覆盖表单级 true，该项 `itemProps.valuePropName !== 'initialValue'`。
- 自定义 `viewWidget` 组件作为逃生舱能被渲染。
- 切换 viewMode 前后 `form.getFieldsValue()` 不变（hook 不写 form 状态）。
运行确认 FAIL。

- [ ] **Step 3: 实现 useFormSchema.ts**

步骤：
1. `options.validate !== false && dev` 时调用 `validateMeta(meta, mergedWidgets)`，issues 进返回值并 `console.warn`；仅「widget 未注册」dev 期 `throw`。生产期未注册 widget 降级 input。
2. `normalizeMeta(meta)` 得 normalized fields；`collectWatchPaths(meta.fields)` 仅作导出用途不参与 hook。
3. `Form.useWatch([], form)` 触发重渲染；`const values = form.getFieldsValue(true)`。
4. 遍历 normalized fields：`visible = condition ? evaluateCondition(condition, {form, values}) : true`；`def = resolveWidget(field.widget, options.widgets)`；`converted = applyConverter(field, def, meta)`；`isView = field.viewMode ?? meta.viewMode ?? false`；view 时 `viewDef = resolveWidget(field.viewWidget ?? 'span', options.widgets)` 并用同样的 converter 流程。
5. `itemProps = getItemProps(converted, { valuePropName: isView ? 'initialValue' : converted.valuePropName })`（view 时覆盖）。
6. `controlProps = getControlProps(converted)`；`WidgetComponent = def.component`；`control = isView ? <ViewSpan initialValue={get(values, converted.name)} options={converted.options}/> : React.createElement(WidgetComponent, controlProps)`；`viewContent = control`（view 时）。
7. 组装 `BoundField`：`{...语义数据, visible, itemProps, control, controlProps, WidgetComponent, viewContent, viewMode: isView}`。
8. 返回 `{ fields, visibleFields: fields.filter(f=>f.visible), getField: key => fields.find(...), issues }`。

- [ ] **Step 4: 运行测试**

Run: `pnpm --filter @jswork/antd-form-schema test -- 05-hook 06-view-mode`
预期：全部 PASS。

- [ ] **Step 5: Commit**

`git add packages/lib/src/useFormSchema.ts packages/lib/__tests__/05-hook.spec.tsx packages/lib/__tests__/06-view-mode.spec.tsx && git commit -m "feat: add useFormSchema hook with conditional visibility and view mode"`

---

### Task 5: FormFields 便捷渲染器与入口导出

**Files:**
- Create: `packages/lib/src/FormFields.tsx`
- Modify: `packages/lib/src/index.tsx`、`packages/lib/__tests__/01-basic.spec.tsx`、`packages/lib/README.md`

**Interfaces:**
- Consumes: Task 2 的 `BoundField`，Task 4 的 hook；classnames。
- Produces: `FormFields: React.FC<{ fields: BoundField[] } & HTMLAttributes<HTMLDivElement>>`；default export = `FormFields`（附带 `version = __VERSION__`）。

- [ ] **Step 1: 重写基础测试**

把 `01-basic.spec.tsx` 整体替换为针对 `FormFields` 与 default export 的测试：
- default import 与 named `FormFields` 指向同一组件。
- 传入一个最小 BoundField（手写对象，含 key/label/required/itemProps/control/visible），渲染后 label 文本、必填星号、control 都出现。
- `className` 与根 div 的 class 正确合并；`visible=false` 的字段不渲染。
- 根 div 带 `data-component="antd-form-schema"`（保留脚手架标识）。
运行确认 FAIL（当前实现是旧 div 组件）。

- [ ] **Step 2: 实现 FormFields.tsx**

薄封装：根 `<div data-component="antd-form-schema" className={cx('antd-form-schema', className)} {...rest}>`；每个 field 渲染一个子 div（label 节点 + 必填星号 + `<Form.Item {...f.itemProps} noStyle>{f.control}</Form.Item>`）。**不提供 columns/gutter/任何布局 props**。

- [ ] **Step 3: 改 index.tsx 入口**

named 导出 `useFormSchema` / `FormFields` / `validateMeta` / `normalizeMeta` / `evaluateCondition` / `collectWatchPaths` 及 `types.ts` 全部类型；`export { FormFields as default }` 并给 FormFields 挂 `version = __VERSION__`（保留脚手架版本号能力）。删除旧 div 组件实现。

- [ ] **Step 4: 重写 README**

`packages/lib/README.md` 改为介绍 headless 用法：安装（antd peer）、`useFormSchema` + 自定义 JSX 的最小示例、`FormFields` 简洁用法、widget 覆盖与条件写法；明确说明 Schema 无布局键、默认导出是 `FormFields`（破坏性变更）。

- [ ] **Step 5: 运行测试与构建**

Run: `pnpm --filter @jswork/antd-form-schema test && pnpm --filter @jswork/antd-form-schema build`
预期：所有测试 PASS；build 产出 4 文件；CJS 通过 `node -e "const m=require('./packages/lib/dist/index.cjs'); console.log(typeof m.useFormSchema, typeof m.default)"` 输出 `function function`。

- [ ] **Step 6: Commit**

`git add packages/lib/src packages/lib/__tests__ packages/lib/README.md && git commit -m "feat: add FormFields renderer and headless public API"`

---

### Task 6: Example 示例站（6 个 demo）

**Files:**
- Create: `packages/example/src/meta.ts`、`packages/example/src/components/{basic-grid,card-groups,custom-widget,view-edit,conditional-form,step-form}.tsx`
- Modify: `packages/example/src/app.tsx`、`packages/example/src/index.scss`（如需）
- Modify: `README.md`（根）

**Interfaces:**
- Consumes: Task 5 的 named exports（通过 alias 直连源码）。
- Produces: 可运行的 dev server，6 个 demo 全部可交互。

- [ ] **Step 1: 写示例站**

`meta.ts` 导出共享的 `basicMeta: FormSchema`（PRD §4.4 完整示例）。
`components/` 下 6 个文件分别实现 PRD §10 的用法：
- `basic-grid.tsx`：Tailwind 两列 grid，`textarea` 用 `md:col-span-2`，label 星号由 JSX 渲染。
- `card-groups.tsx`：`<details>` 分组折叠，用 `getField(key)` 按组取字段。
- `custom-widget.tsx`：把 `select` 改成 `Radio.Group optionType="button"`，并用 `widgets` 局部注册一个新的 `radio-button` id。
- `view-edit.tsx`：一个 checkbox 切换 `viewMode`，同一 Schema 在编辑/查看间切换，enum 显示 label。
- `conditional-form.tsx`：`role === 'admin'` 显示 company；再加一个 and/or 复合条件示例。
- `step-form.tsx`：用条件显隐 + 多段 JSX 实现两步表单（**不引入 `Form.List`**）。

`app.tsx` 用简单的顶部导航分区展示 6 个 demo，保留 `BUILD_TIME` 徽标。全部布局用 `div` + Tailwind，Schema 里没有任何布局键。

- [ ] **Step 2: 更新根 README**

`README.md` 改为项目简介 + 快速开始（`pnpm install` / `pnpm dev` / `pnpm test` / `pnpm build`）+ 指向 lib README 与 `docs/requirements/002-final-prd.md`。

- [ ] **Step 3: 启动 dev server 验证**

Run: `pnpm dev`，把地址给用户，请用户在浏览器逐个检查 6 个 demo（按全局规则不自动截图/dump-dom）。

预期：Vite 启动无报错；6 个 demo 都能渲染且与 antd 控件交互；条件切换、查看态切换、自定义控件均生效。

- [ ] **Step 4: Commit**

`git add packages/example README.md && git commit -m "feat: add example site with six headless form demos"`

---

### Task 7: 全量验证与验收

**Files:** 无新增（仅验证）

- [ ] **Step 1: 全量测试**

Run: `pnpm test`
预期：全部 spec PASS，无 skipped。

- [ ] **Step 2: 全量构建**

Run: `pnpm build`
预期：`docs` 脚本先生成文档，tsup 产出 `dist/index.mjs` / `index.cjs` / `index.d.ts` / `style.css`；无报错。

- [ ] **Step 3: 交付检查**

按 PRD §12 总体验收逐项核对：Schema 中无布局键；布局/样式 100% 由 div + Tailwind 完成；6 个 demo 可操作；CJS/ESM named export 均可用。若发现偏差，先把偏差写进设计文档的调用记录，再修复。

- [ ] **Step 4: Commit（如有修复）**

仅当上一步产生代码改动时提交：`git commit -m "fix: address acceptance gaps"`。
