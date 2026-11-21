# valueType + normalizeValues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let schema fields declare a value type (`valueType`) so date widgets store strings/timestamps instead of dayjs objects, and add a meta-level `normalizeValues` for pre-submit whole-value transforms.

**Architecture:** `valueType`/`valueFormat` flow through types → normalize passthrough → a date-specific metaConverter that injects antd 5.14+ `valueFormat` (string case) or wraps onChange (timestamp case). `normalizeValues` is declared on `FormSchema` (and as a prop on `SchemaForm`), applied by wrapping `onFinish`. Conversion happens at render/binding layer so form values are already final.

**Tech Stack:** React 18, antd 5.14+, TypeScript, vitest + @testing-library/react, tsup.

**Spec:** `docs/superpowers/specs/2026-11-21-value-type-normalize-design.md`

## Global Constraints

- antd >= 5.14 required (DatePicker `valueFormat`); no compatibility shim.
- Default `valueType` is `'dayjs'` — zero-config behavior must stay byte-identical to today.
- `valueFormat` default `'YYYY-MM-DD'`, only meaningful when `valueType === 'string'`.
- `valueType: 'timestamp' | 'number'` both mean milliseconds via `dayjs(...).valueOf()`.
- No layout/style keys on FieldSchema — valueType is value semantics, allowed.
- English code comments / commit messages; docs in Chinese go to docs/.
- pnpm; tests: `pnpm test` in `packages/lib`.

## Review Focus

1. **`valueType` on non-date widgets** — expect: silently ignored (no converter consumes it); test pins via `input` + `valueType` producing no onChange wrapper (Task 2 test).
2. **`valueFormat` without `valueType: 'string'`** — expect: ignored unless string/timestamp semantics apply; pinned by test in Task 2.
3. **Range/array date values** — DatePicker.RangePicker users pass widgetProps directly; converter wrapper must apply per-item for timestamp, pass-through antd handling for string (`valueFormat` handles arrays natively). Pinned by Task 3 test with `widgetProps: { picker: ... }` array value.
4. **Timestamp echo (edit mode)** — form stores a number; DatePicker must receive a dayjs to render. The onChange wrapper only converts outbound; the plan pins inbound conversion via `getValueProps`-free approach: converter also injects no inbound transform (antd parses number? it does not) — Task 3 test pins echo of a stored timestamp rendering the correct date text; if antd can't parse, wrap with `getValueProps` in the same converter.
5. **`normalizeValues` not provided** — expect: `onFinish` receives raw values unchanged; pinned by Task 4 test.

---

### Task 1: Types + normalize passthrough

**Files:**
- Modify: `packages/lib/src/core/types.ts` (FieldSchema ~line 36, BoundField, FormSchema)
- Modify: `packages/lib/src/useFormSchema.ts` (~line 81 BoundField construction)
- Test: existing type checks only; runtime tests come in later tasks.

**Interfaces:**
- Produces: `FieldSchema.valueType?: 'dayjs' | 'string' | 'number' | 'timestamp'`, `FieldSchema.valueFormat?: string`, `BoundField.valueType?`, `BoundField.valueFormat?`, `FormSchema.normalizeValues?: (values: Record<string, any>) => Record<string, any>`.

- [ ] **Step 1: Add fields to `FieldSchema`** after `valuePropName`:

```ts
  /** Form-level value type; date widgets convert outbound values. Default 'dayjs' (no conversion). */
  valueType?: 'dayjs' | 'string' | 'number' | 'timestamp';
  /** Format override, only meaningful with valueType 'string'. Default 'YYYY-MM-DD'. */
  valueFormat?: string;
```

- [ ] **Step 2: Add to `BoundField`** after `className`:

```ts
  valueType?: 'dayjs' | 'string' | 'number' | 'timestamp';
  valueFormat?: string;
```

- [ ] **Step 3: Add to `FormSchema`** after `disabled`:

```ts
  /** Whole-values transform applied before onFinish in SchemaForm. */
  normalizeValues?: (values: Record<string, any>) => Record<string, any>;
```

- [ ] **Step 4: Pass through in `useFormSchema.ts`** — add `valueType: field.valueType, valueFormat: field.valueFormat,` to the BoundField literal (after `className: field.className,`).

- [ ] **Step 5: Verify** — run `pnpm build` in packages/lib. Expected: build success (no behavior change).

- [ ] **Step 6: Commit**

```bash
git add packages/lib/src/core/types.ts packages/lib/src/useFormSchema.ts
git commit -m "feat(lib): add valueType/valueFormat/normalizeValues schema fields"
```

### Task 2: validateMeta warnings for valueType

**Files:**
- Modify: `packages/lib/src/core/validate.ts` (inside `fields.forEach`, after the options check)
- Test: `packages/lib/__tests__/07-validate.spec.ts`

**Interfaces:**
- Consumes: `FieldSchema.valueType` from Task 1.
- Produces: warning issue `unknown valueType "<v>"` for values outside the allowed set.

- [ ] **Step 1: Write failing tests** in `07-validate.spec.ts` (append, matching file style):

```ts
it('warns on unknown valueType', () => {
  const issues = validateMeta({ fields: [{ key: 'a', valueType: 'banana' }] } as any);
  expect(issues).toContainEqual(
    expect.objectContaining({ level: 'warning', message: expect.stringContaining('unknown valueType "banana"') }),
  );
});

it('accepts known valueTypes silently', () => {
  const issues = validateMeta({
    fields: [
      { key: 'a', valueType: 'string' },
      { key: 'b', valueType: 'timestamp' },
      { key: 'c', valueType: 'dayjs' },
      { key: 'd', valueType: 'number' },
    ],
  });
  expect(issues).toHaveLength(0);
});
```

- [ ] **Step 2: Run** `pnpm vitest run 07-validate`. Expected: FAIL (no warning emitted).

- [ ] **Step 3: Implement** in `validate.ts` after the options check:

```ts
const VALUE_TYPES = ['dayjs', 'string', 'number', 'timestamp'];
// after options check:
if (field.valueType !== undefined && !VALUE_TYPES.includes(field.valueType)) {
  issues.push({
    level: 'warning',
    message: `unknown valueType "${field.valueType}"`,
    field: field.key,
  });
}
```

- [ ] **Step 4: Run** `pnpm vitest run 07-validate`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/lib/src/core/validate.ts packages/lib/__tests__/07-validate.spec.ts
git commit -m "feat(lib): warn on unknown valueType in validateMeta"
```

### Task 3: Date widget valueType conversion

**Files:**
- Modify: `packages/lib/src/widgets/index.tsx` (date converters, `WIDGETS` entries for `date-picker` / `date-time`)
- Test: `packages/lib/__tests__/04-widgets.spec.tsx`

**Interfaces:**
- Consumes: `FieldSchema.valueType`/`valueFormat` from Task 1; `applyConverter` shallow-merge of `widgetProps` (exists).
- Produces: for `valueType: 'string'`, DatePicker receives `valueFormat` (default `'YYYY-MM-DD'`, overridable). For `'timestamp' | 'number'`, DatePicker receives an onChange wrapper storing `dayjs(v).valueOf()` (per-item for arrays) and a `getValueProps` mapping stored value → dayjs. For `'dayjs'`/undefined: nothing injected.

- [ ] **Step 1: Write failing tests** in `04-widgets.spec.tsx` (append; render via the existing widget-test harness used by that file):

```tsx
it('injects valueFormat for valueType string', () => {
  const { normalizeMeta } = require('./normalize'); // keep file's own import style
  const { applyConverter, resolveWidget } = require('./widgets');
  const field = normalizeMeta({ fields: [{ key: 'd', widget: 'date-picker', valueType: 'string' }] }).fields[0];
  const converted = applyConverter(field, resolveWidget('date-picker'), { fields: [] } as any);
  expect(converted.widgetProps).toMatchObject({ valueFormat: 'YYYY-MM-DD' });
});

it('allows valueFormat override with valueType string', () => {
  const field = normalizeMeta({ fields: [{ key: 'd', widget: 'date-picker', valueType: 'string', valueFormat: 'YYYY/MM/DD' }] }).fields[0];
  const converted = applyConverter(field, resolveWidget('date-picker'), { fields: [] } as any);
  expect(converted.widgetProps).toMatchObject({ valueFormat: 'YYYY/MM/DD' });
});

it('ignores valueType on non-date widgets', () => {
  const field = normalizeMeta({ fields: [{ key: 't', widget: 'input', valueType: 'string' }] }).fields[0];
  const converted = applyConverter(field, resolveWidget('input'), { fields: [] } as any);
  expect(converted.widgetProps).toBeUndefined();
});
```

(If the file already imports `normalizeMeta`/`applyConverter`, use those imports instead of `require`.)

- [ ] **Step 2: Run** `pnpm vitest run 04-widgets`. Expected: FAIL.

- [ ] **Step 3: Implement** a shared date converter in `widgets/index.tsx`:

```ts
const dateConverter: Converter = ({ field }: ConverterContext) => {
  const widgetProps: Record<string, any> = {};
  if (field.valueType === 'string') {
    widgetProps.valueFormat = field.valueFormat ?? 'YYYY-MM-DD';
  } else if (field.valueType === 'timestamp' || field.valueType === 'number') {
    widgetProps.getValueProps = (value: any) => ({
      value: Array.isArray(value)
        ? value.map((v) => (v == null ? v : dayjs(v)))
        : value == null ? value : dayjs(value),
    });
    const toStore = (v: any) => (v == null ? v : dayjs(v).valueOf());
    const prevOnChange = (field.widgetProps as any)?.onChange;
    widgetProps.onChange = (value: any) =>
      prevOnChange?.(Array.isArray(value) ? value.map(toStore) : toStore(value));
  }
  return { widgetProps };
};
```

Wire: `'date-picker': { component: DatePicker, metaConverter: dateConverter }`; `'date-time'` keeps `showTime` by composing — change its metaConverter to `() => ({ widgetProps: { showTime: true }, ...dateConverter(ctx) })` — implementer should merge via `applyConverter`'s existing shallow merge by making date-time's converter call `dateConverter` and spread `{ showTime: true }` last (showTime wins is fine; valueType props must survive).

Add `import dayjs from 'dayjs';` at top (dayjs is already a transitive dep of antd; add to lib's package.json dependencies if not present).

- [ ] **Step 4: Run** `pnpm vitest run 04-widgets`. Expected: PASS.

- [ ] **Step 5: Render-level echo test** (timestamp → DatePicker shows the date): append to `04-widgets.spec.tsx` using the file's existing full-render harness:

```tsx
it('echoes a stored timestamp back as a date', () => {
  // render Form initialValues { d: 1705276800000 } with a date-picker field valueType timestamp
  // expect the input to display '2024-01-15' (or the matching formatted text)
});
```

Assertions: stored value echo renders the human-readable date; after user picks a date, `form.getFieldValue('d')` is a number.

- [ ] **Step 6: Run** `pnpm vitest run 04-widgets`. Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/lib/src/widgets/index.tsx packages/lib/__tests__/04-widgets.spec.tsx packages/lib/package.json
git commit -m "feat(lib): date widgets honor valueType/valueFormat"
```

### Task 4: normalizeValues on SchemaForm

**Files:**
- Modify: `packages/lib/src/components/SchemaForm.tsx`
- Modify: `packages/lib/src/components/SchemaFields.tsx` (props interface only — accept and ignore is NOT the design; instead SchemaFields passes nothing; skip if wrapper only belongs to SchemaForm)
- Test: `packages/lib/__tests__/08-schema-form.spec.tsx`

**Interfaces:**
- Consumes: `FormSchema.normalizeValues` from Task 1.
- Produces: `SchemaForm` wraps user `onFinish` so it receives `normalizeValues(values)` result. Prop `normalizeValues` on SchemaFormProps wins over `meta.normalizeValues`.

- [ ] **Step 1: Write failing tests** in `08-schema-form.spec.tsx`:

```tsx
it('applies meta.normalizeValues before onFinish', () => {
  const meta = { fields: [{ key: 'name' }], normalizeValues: (v: any) => ({ ...v, extra: 1 }) };
  const onFinish = vi.fn();
  render(<SchemaForm meta={meta as any} onFinish={onFinish}><button type="submit">go</button></SchemaForm>);
  fireEvent.change(screen.getByPlaceholderText(/请输入姓名|input/i) as any, { target: { value: 'x' } }); // or setValue via form if harness differs
  fireEvent.click(screen.getByText('go'));
  // waitFor
  expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ extra: 1 }));
});

it('onFinish receives raw values when normalizeValues is absent', () => {
  const meta = { fields: [{ key: 'name' }] };
  const onFinish = vi.fn();
  // same render; expect onFinish called once with values lacking 'extra'
});
```

Implementer should adapt fill/submit mechanics to the harness patterns already used in this spec file (existing tests show how values get set); the assertion contract is fixed above.

- [ ] **Step 2: Run** `pnpm vitest run 08-schema-form`. Expected: FAIL.

- [ ] **Step 3: Implement** in `SchemaForm.tsx`:

```ts
normalizeValues, // add to props destructure
// inside component:
const handleFinish: FormProps['onFinish'] = (values) =>
  rest.onFinish?.(normalize ?? meta.normalizeValues?.((values as any)) ?? values);
// <Form {...restWithoutOnFinish} onFinish={handleFinish} ...>
```

Care: strip original `onFinish` from `...rest` before spreading onto `<Form>`; keep it only via `handleFinish`. If no `onFinish` is given by the user but `normalizeValues` exists, still wrap (harmless). Exact merge: user prop `normalizeValues` > `meta.normalizeValues` > identity.

- [ ] **Step 4: Run** `pnpm vitest run 08-schema-form`. Expected: PASS.

- [ ] **Step 5: Run the full suite** `pnpm test` in packages/lib. Expected: 87+ tests pass, 0 regressions.

- [ ] **Step 6: Commit**

```bash
git add packages/lib/src/components/SchemaForm.tsx packages/lib/__tests__/08-schema-form.spec.tsx
git commit -m "feat(lib): apply normalizeValues before SchemaForm onFinish"
```

### Task 5: Docs touch-up + full verification

**Files:**
- Modify: `packages/lib/llms.txt` (if it documents FieldSchema keys; check first)
- Modify: `packages/lib/README.md` (only if it documents field keys)

- [ ] **Step 1: Grep** `grep -n "widget\b" packages/lib/llms.txt packages/lib/README.md | head` — if neither documents the field-key list, skip both edits.

- [ ] **Step 2: If documenting, add** the three keys with one-line Chinese-English comment each, matching file style.

- [ ] **Step 3: Final verify:** `pnpm build && pnpm test` in packages/lib. Expected: build success, all tests pass.

- [ ] **Step 4: Commit (only if files changed)**

```bash
git add packages/lib/llms.txt packages/lib/README.md
git commit -m "docs(lib): document valueType/valueFormat/normalizeValues"
```
