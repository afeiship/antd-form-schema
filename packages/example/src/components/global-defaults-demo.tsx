import { useState } from 'react';
import { Button } from 'antd';
import { getSchemaFormDefaults, SchemaForm } from '@jswork/antd-form-schema';
import type { FormSchema } from '@jswork/antd-form-schema';

const meta: FormSchema = {
  initialValues: { title: '季度报表', status: 'active', price: 1999, discount: 0.125 },
  fields: [
    { key: 'title', required: true },
    { key: 'status', options: [['active', '活跃'], ['disabled', '禁用']] },
    { key: 'price', converter: 'money' },
    { key: 'discount', converter: 'ratio' },
  ],
};

export default function GlobalDefaultsDemo() {
  const [values, setValues] = useState<Record<string, any> | null>(null);
  const defaults = getSchemaFormDefaults();

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        这个表单没有传 presets / converters / locale，三项都来自项目入口的 configureSchemaForm。
      </p>

      <SchemaForm
        meta={meta}
        classNames={{ form: 'grid grid-cols-1 gap-4 md:grid-cols-2' }}
        onFinish={(formValues) => setValues(formValues)}>
        <div className="col-span-full flex justify-end">
          <Button htmlType="submit" type="primary">
            Submit
          </Button>
        </div>
      </SchemaForm>

      <div className="text-sm">
        <div className="mb-1 font-medium">Global defaults</div>
        <pre className="max-h-40 overflow-auto rounded bg-gray-50 p-3 text-xs">
          {JSON.stringify({ locale: defaults.locale, presets: defaults.presets }, null, 2)}
        </pre>
      </div>

      <div className="text-sm">
        <div className="mb-1 font-medium">Stored values</div>
        <pre className="rounded bg-gray-50 p-3 text-xs">
          {values ? JSON.stringify(values, null, 2) : 'submit to inspect'}
        </pre>
      </div>
    </div>
  );
}
