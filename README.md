# antd-form-schema
> A tiny headless schema renderer for Ant Design form fields and rules.

[![version][version-image]][version-url]
[![license][license-image]][license-url]
[![download][download-image]][download-url]

## installation
```shell
pnpm add @jswork/antd-form-schema
```

## usage
  ```js
  import { useState } from 'react';
  import BasicGrid from './components/basic-grid';
  import CardGroups from './components/card-groups';
  import CustomWidget from './components/custom-widget';
  import ViewEdit from './components/view-edit';
  import ConditionalForm from './components/conditional-form';
  import StepForm from './components/step-form';
  import SchemaFormDemo from './components/schema-form-demo';
  import SlotsDemo from './components/slots-demo';

  const demos = [
    { key: 'schema-form', title: 'Schema Form', Component: SchemaFormDemo },
    { key: 'basic-grid', title: 'Basic Grid', Component: BasicGrid },
    { key: 'card-groups', title: 'Card Groups', Component: CardGroups },
    { key: 'custom-widget', title: 'Custom Widget', Component: CustomWidget },
    { key: 'view-edit', title: 'View / Edit', Component: ViewEdit },
    { key: 'conditional', title: 'Conditional', Component: ConditionalForm },
    { key: 'step-form', title: 'Step Form', Component: StepForm },
    { key: 'slots', title: 'Slots', Component: SlotsDemo },
  ];

  function App() {
    const [active, setActive] = useState(demos[0].key);
    const current = demos.find((demo) => demo.key === active) ?? demos[0];

    return (
      <div className="min-h-screen bg-gray-50 text-gray-800">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="relative mb-6 rounded-lg bg-white p-6 shadow">
            <div className="badge badge-warning absolute right-4 top-4">Build Time: {BUILD_TIME}</div>
            <h1 className="text-2xl font-bold">@jswork/antd-form-schema</h1>
            <p className="mt-1 text-sm text-gray-500">
              Headless Ant Design form binding — layout lives in JSX, never in the schema.
            </p>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {demos.map((demo) => (
              <button
                key={demo.key}
                type="button"
                onClick={() => setActive(demo.key)}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active === demo.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                {demo.title}
              </button>
            ))}
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-6 border-b pb-3 text-lg font-semibold">{current.title}</h2>
            <current.Component />
          </div>
        </div>
      </div>
    );
  }

  export default App;
  ```

## project defaults

Configure `presets`, `converters` and `locale` once at the project entry. Every `SchemaForm`, `SchemaFields` and `useFormSchema` call picks them up; per-form props only override.

```tsx
// main.tsx
import { configureSchemaForm } from '@jswork/antd-form-schema';

configureSchemaForm({
  locale: 'zh-CN',
  presets: projectPresets,
  converters: projectConverters,
});
```

```tsx
// any form: no repeated presets / converters / locale
<SchemaForm meta={meta} />

// override only what this form needs
<SchemaForm meta={meta} locale="en-US" converters={{ ratio }} />
```

- `configureSchemaForm(defaults)` shallow-merges the provided fields; call it before mounting components.
- Priority: form-level prop → project defaults → built-in fallback (`zh-CN`, built-in widgets and labels).
- `presets` merge per key: form-level `fields` and `labels[locale]` win while the remaining project entries stay available.
- `converters` merge per id: a form-level implementation with the same id replaces the project one; other ids remain registered.
- `getSchemaFormDefaults()` returns a snapshot; `resetSchemaFormDefaults()` clears everything (useful in tests and HMR).
- The config is module-level state. SSR multi-tenant apps should use per-form props instead.

## field converters
A converter adapts one field between its stored value and its control value. Register converters once and reference them by id in the schema; the field keeps its own key and nothing else changes.

```tsx
import { SchemaForm } from '@jswork/antd-form-schema';
import type { FieldConverter, FormSchema } from '@jswork/antd-form-schema';

/** cents in storage <-> yuan in the control */
const money: FieldConverter = {
  read: (value) => (value == null ? value : Number(value) / 100),
  write: (value) => (value == null ? value : Math.round(Number(value) * 100)),
};

const meta: FormSchema = {
  initialValues: { price: 1999 },
  converters: { price: 'money' },
  fields: [{ key: 'price', label: 'Price', widget: 'number' }],
};

<SchemaForm meta={meta} converters={{ money }} />;
```

- `read(value, ctx)` maps the stored value to the control value; it only runs for display and view mode.
- `write(value, ctx)` maps the control value back to the stored value.
- `ctx` is `{ field, values, meta }`. Read the whole form through `values`, but never write other fields from a converter.
- Form-wide defaults live on the schema: `meta.converters` maps a field key to a converter id, and a field's own `converter` wins over it.
- A converter cannot be combined with `valueType`; omit it for zero behavior change.
- An unregistered converter id is a fatal error. Throwing inside a converter falls back to the raw value and warns in dev.
- Chains are arrays: `read` runs left to right, `write` runs right to left, so every step must be reversible.
  `converter: ['money', 'fixed2']` shows `1999` as `"19.99"` and stores `"20.50"` as `2050`.
- `meta.converters` accepts the same array form. A field's own `converter` replaces the whole chain.
- A chain longer than one warns in dev when a member has no `write`; an empty array means no conversion.
- Fields without a converter are untouched; `getValueProps` / `getValueFromEvent` set directly on the field still win.

## license
Code released under [the MIT license](https://github.com/afeiship/antd-form-schema/blob/main/LICENSE.txt).

[version-image]: https://img.shields.io/npm/v/@jswork/antd-form-schema
[version-url]: https://npmjs.org/package/@jswork/antd-form-schema

[license-image]: https://img.shields.io/npm/l/@jswork/antd-form-schema
[license-url]: https://github.com/afeiship/antd-form-schema/blob/main/LICENSE.txt

[download-image]: https://img.shields.io/npm/dm/@jswork/antd-form-schema
[download-url]: https://www.npmjs.com/package/@jswork/antd-form-schema
