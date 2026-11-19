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
            <label className="block mb-1 text-sm font-medium text-gray-700">
              {f.label}{f.required && <span className="text-red-500"> *</span>}
            </label>
            <Form.Item {...f.itemProps} noStyle>{f.control}</Form.Item>
          </div>
        ))}
      </div>
      <Button htmlType="submit" type="primary">Submit</Button>
    </Form>
  );
}
```
`itemProps` contains only data-binding keys (`name`, `rules`, `valuePropName`, `dependencies`, `shouldUpdate`); it deliberately has no `label`/`className`/`style`. Layout and the label asterisk belong in your JSX.

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

> **Breaking change:** the default export is now an alias of `FormFields` (previously an empty scaffold `div` component). Named exports are the primary API.

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
Named: `useFormSchema`, `FormFields`, `validateMeta`, `normalizeMeta`, `evaluateCondition`, `collectWatchPaths` and all types from `types.ts`.
Default: `AntdFormSchema` = `FormFields` (with `version`), kept for scaffold compatibility.

## license
Code released under the MIT license.
