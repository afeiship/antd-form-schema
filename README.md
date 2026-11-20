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

## license
Code released under [the MIT license](https://github.com/afeiship/antd-form-schema/blob/main/LICENSE.txt).

[version-image]: https://img.shields.io/npm/v/@jswork/antd-form-schema
[version-url]: https://npmjs.org/package/@jswork/antd-form-schema

[license-image]: https://img.shields.io/npm/l/@jswork/antd-form-schema
[license-url]: https://github.com/afeiship/antd-form-schema/blob/main/LICENSE.txt

[download-image]: https://img.shields.io/npm/dm/@jswork/antd-form-schema
[download-url]: https://www.npmjs.com/package/@jswork/antd-form-schema
