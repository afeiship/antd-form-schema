# antd-form-schema
> A tiny headless schema renderer for Ant Design form fields and rules.

## installation
```shell
pnpm add @jswork/antd-form-schema antd
```
`antd`, `react`, `react-dom` and `classnames` are peer dependencies.

The schema describes only **what a field is** (widget id, data, text, validation, conditions) — never **how it looks**. No layout, grid or style keys exist in the schema.

## headless usage (`useFormSchema`)
```tsx
import { Button, Form } from 'antd';
import { useFormSchema } from '@jswork/antd-form-schema';
import type { FormSchema } from '@jswork/antd-form-schema';

const meta: FormSchema = {
  fields: [
    { key: 'name', label: 'Name', widget: 'input', required: true },
    { key: 'role', label: 'Role', widget: 'select', options: ['admin', 'user'] },
    {
      key: 'company', label: 'Company', widget: 'input',
      condition: { field: 'role', op: 'eq', value: 'admin' },
    },
  ],
};

function UserForm() {
  const [form] = Form.useForm();
  const { visibleFields } = useFormSchema(meta, form);
  return (
    <Form form={form} initialValues={{ role: 'user' }} onFinish={console.log} layout="vertical">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleFields.map((f) => (
          <div key={f.key} className={f.widget === 'textarea' ? 'md:col-span-2' : ''}>
            <Form.Item {...f.props} label={f.label} required={f.required}>
              {f.control}
            </Form.Item>
          </div>
        ))}
      </div>
      <Button htmlType="submit" type="primary">Submit</Button>
    </Form>
  );
}
```
`props` contains only data-binding keys (`name`, `rules`, `valuePropName`, `dependencies`, `shouldUpdate`); it deliberately has no `label`/`className`/`style`. Pass `label` to `Form.Item` yourself for accessible labels — layout remains in your JSX.

## convenience renderer (`FormFields`)
For simple cases, `FormFields` is a thin vertical wrapper around `Form.Item` and `f.control`:

```tsx
import { Form } from 'antd';
import { FormFields, useFormSchema } from '@jswork/antd-form-schema';

function SimpleForm() {
  const [form] = Form.useForm();
  const { visibleFields } = useFormSchema(meta, form);
  return (
    <Form form={form}>
      <FormFields fields={visibleFields} className="space-y-4" />
    </Form>
  );
}
```
`FormFields` has **no** `columns`/`gutter` or any other layout props — use custom JSX when you need layout.

## quick start (`SchemaForm` / `SchemaFields`)

For common forms, skip the JSX boilerplate. `SchemaForm` creates the Form for you — pass a meta and you are done:

```tsx
import { SchemaForm } from '@jswork/antd-form-schema';
import type { FormClassNames } from '@jswork/antd-form-schema';

const classNames: FormClassNames = {
  form: 'grid grid-cols-2 gap-4',
  field: 'rounded border p-3',
  label: 'mb-1 block text-sm font-medium',
  control: 'w-full',
};

<SchemaForm meta={meta} onFinish={save} classNames={classNames}>
  <Button htmlType="submit" type="primary">Submit</Button>
</SchemaForm>
```

Need to own the form (read/validate values, reset, etc.)? Use `SchemaFields` inside your own `<Form>`:

```tsx
import { Button, Form } from 'antd';
import { SchemaFields } from '@jswork/antd-form-schema';

const [form] = Form.useForm();
<Form form={form} onFinish={save}>
  <div className="grid grid-cols-2 gap-4">
    <SchemaFields meta={meta} classNames={{ field: 'rounded border p-3' }} />
  </div>
  <Button htmlType="submit">Submit</Button>
</Form>
```

- Layout is controlled by one `classNames` object (keys mirror the parts: `form` / `field` / `label` / `control`) — Tailwind classes, never schema keys. `classNames.form` applies only to `SchemaForm`; on `SchemaFields` it is ignored with a dev warning.
- Initial values come **only** from `meta.initialValues`.
- Date fields store dayjs objects by default; declare `valueType: 'string' | 'number' | 'timestamp'` on a date field (optional `valueFormat`, default `YYYY-MM-DD`, string type only) to store plain values instead. Conversion wraps the form store — antd React's DatePicker has no native `valueFormat`.
- `meta` may be a `Promise<FormSchema>` — components render a loading placeholder until it resolves (`loading`/`error` props customize the placeholders). Fields mount only after resolve, so late `initialValues` apply correctly.
- `normalizeValues` (on `meta` or as a `SchemaForm` prop) transforms the whole values object right before `onFinish` — for cross-field cleanup the schema cannot express.
- `label`, required mark and validation errors are rendered by antd `Form.Item` itself (so clicking a label focuses its control; error messages use antd styles).
- For extreme customization, drop down to `useFormSchema` and write your own JSX.

> **Breaking change:** the default export is now an alias of `FormFields` (previously an empty scaffold `div` component). Named exports are the primary API.

## key presets (label + widget)

Define each key's standard shape once — its label (locale-aware) and its widget — then keep schemas to bare keys. Anything you still write on a field always wins.

```yaml
# presets.yaml
fields:
  title: input
  status: select
labels:
  zh-CN:
    title: 标题
    status: 状态
```

```tsx
import presets from './presets.yaml'; // e.g. Vite + @rollup/plugin-yaml
<SchemaForm meta={{ fields: [{ key: 'title' }, { key: 'status' }] }} presets={presets} />;
```

- Priority — widget: `schema.widget` > `presets.fields[key]` > `input`. Label: `schema.label` > `presets.labels[locale][key]` > `presets.labels['zh-CN'][key]` > builtin dictionary > **the key itself**.
- `locale` defaults to `zh-CN`; a missing language or a missing key silently falls back — no warnings, no errors.
- A flat single-language table is also accepted: `presets={{ title: '标题', name: '姓名' }}`.
- Presets never create fields: entries whose key is absent from `meta.fields` are ignored.
- Only `widget` and `label` are taken from presets; options, placeholder and rules stay in the schema.

## slots

`SchemaForm` and `SchemaFields` render each field with three replaceable parts (`slots` is a component prop, never a schema key). The `<label htmlFor>`, required mark and error text are always owned by antd `Form.Item`:

- `label` — overrides the **label content** (antd still wraps it in `<label>` and adds the required mark)
- `control` — overrides the `Form.Item` children (the value-bound control)
- `field` — overrides the wrapper around the whole `Form.Item`

Every slot accepts three shapes: a component, a ReactNode, or `{ component, props }`. Runtime context (`field`, and the part's own props) is passed to the component; a ReactNode is rendered as-is. For `control` and `field` use the component shape — a static ReactNode cannot host a live input.

```tsx
import { SchemaForm } from '@jswork/antd-form-schema';
import type { FormSlots } from '@jswork/antd-form-schema';

const slots: FormSlots = {
  label: ({ field }) => <abbr title={String(field.label)}>{String(field.label)}</abbr>,
  control: ({ control, field }) => (
    <div className="flex items-center gap-2">
      <div className="flex-1">{control}</div>
      {field.key === 'age' && <span>岁</span>}
    </div>
  ),
};

<SchemaForm meta={meta} slots={slots} />;
```

Only replace the parts you need — any slot you omit falls back to the default (`Form.Item`-based) rendering. Custom slots own their markup and classes; the four `className` props still style only the default renderers.

## widget override & conditions
Pass a `widgets` map to `useFormSchema` to register or override widget ids. A widget is a string id or a component escape hatch:

```tsx
import Rate from 'antd/es/rate';
import type { WidgetDef } from '@jswork/antd-form-schema';

const widgets: Record<string, WidgetDef> = {
  rate: { component: Rate },
};
const { visibleFields } = useFormSchema(
  { fields: [{ key: 'rating', label: 'Rating', widget: 'rate' }] },
  form,
  { widgets },
);
```
Conditions can be declarative or a function with auto watch paths:

```tsx
{ key: 'company', condition: { field: 'role', op: 'eq', value: 'admin' } }
{ key: 'info', watch: ['role'], condition: ({ values }) => values.role === 'admin' }
```

## exports
Named: `useFormSchema`, `FormFields`, `SchemaFields`, `SchemaForm`, `validateMeta`, `normalizeMeta`, `evaluateCondition`, `collectWatchPaths`, type `FormSlots` and all types from `types.ts` (including `Presets`, `PresetsInput`, `PresetField`).
Default: `AntdFormSchema` = `FormFields` (with `version`), kept for scaffold compatibility.

## license
Code released under the MIT license.
