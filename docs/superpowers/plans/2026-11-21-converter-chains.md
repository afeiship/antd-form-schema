# Converter 链式组合实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 支持字段按顺序经过多个 converter：`read` 正序，`write` 逆序；保持单 converter 与零配置行为不变。

**设计文档：** `docs/superpowers/specs/2026-11-21-converter-chains-design.md`

---

## Task 1: 类型与核心执行链

- [x] **Step 1: 类型** — `FieldSchema.converter`、`FormSchema.converters` 的 value、`BoundField.converter` 扩展为 `string | string[]`。
- [x] **Step 2: 归一化** — `core/converters.ts` 新增 `normalizeConverterIds`、`resolveConverterChain`，把引用归一为 `{ id, converter }[]`。
- [x] **Step 3: 双向执行** — `applyFieldConverter` 接收链：`read` 正序 reduce，`write` 逆序 reduce；整链一个 try/catch，失败回退原始输入并只 warn 一次。
- [x] **Step 4: 视图读值** — `readConvertedValue` 走正序链。
- [x] **Step 5: hook 接入** — `useFormSchema` 解析生效引用 `field.converter ?? meta.converters?.[key]`，构造链与 ctx，`BoundField.converter` 返回原配置形态。
- [x] **Step 6: 类型检查** — `cd packages/lib && ./node_modules/.bin/tsc --noEmit -p tsconfig.json`。

## Task 2: 校验

- [x] **Step 1: 逐项注册校验** — 链中任一 id 未注册 → error `unregistered converter "x"`。
- [x] **Step 2: 互斥校验** — 链非空且字段有 `valueType` → error，消息使用 `a,b` 形式。
- [x] **Step 3: 单向成员** — 链长 > 1 且成员缺 `write` → warning `converter "x" in chain "a,b" has no write`。
- [x] **Step 4: 空链** — `[]` 等同于未配置，不产生任何 issue。

## Task 3: 测试

- [x] **Step 1: 单测** — 正序读、逆序写（spy 调用顺序）、空链、单字符串回归、抛错回退且只 warn 一次。
- [x] **Step 2: 渲染测试** — 字段链 `['money','fixed2']` 显示 `"19.99"`、输入 `"20.50"` 存 `2050`；字段链覆盖 `meta.converters`；`meta.converters` 数组生效；未知 id、`valueType` 冲突、缺 `write` warning。
- [x] **Step 3: 全量回归** — `./node_modules/.bin/vitest run`，既有 146 项保持通过。

## Task 4: 文档与示例

- [x] **Step 1: README** — 增加链式小节：数组顺序、写回逆序、可逆性约束、空数组。
- [x] **Step 2: example** — `price` 改成 `['money', 'fixed2']`，补充 `fixed2`，展示初始 `"19.99"` 与提交 `1999`。
- [x] **Step 3: 类型检查** — `cd packages/lib && ./node_modules/.bin/tsup`；`cd ../example && ../lib/node_modules/.bin/tsc --noEmit -p tsconfig.json`。

## Task 5: 提交

- [x] **Step 1** — 按模块拆分 commit：core、tests、README、example、plan 勾选；全部不 push。
