import { useState } from 'react';
import SchemaFormDemo from './components/schema-form-demo';
import PresetsDemo from './components/presets-demo';
import DetailEditDemo from './components/detail-edit-demo';

const demos = [
  { key: 'schema-form', title: 'Schema Form', Component: SchemaFormDemo },
  { key: 'presets', title: 'Key Presets', Component: PresetsDemo },
  { key: 'detail-edit', title: 'Detail → Edit', Component: DetailEditDemo },
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
