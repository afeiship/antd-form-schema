import { useState } from 'react';
import { Button, Radio } from 'antd';
import { SchemaForm } from '@jswork/antd-form-schema';
import type { FormSchema } from '@jswork/antd-form-schema';
import { presets, profileMeta } from '../presets';

const meta = profileMeta as FormSchema;

const classNames = {
  form: 'grid grid-cols-1 gap-4 md:grid-cols-2',
  field: 'rounded border p-3 !mb-0 hover:bg-gray-50',
  label: 'mb-1 block text-sm font-medium text-gray-700',
  control: 'w-full',
};

/** Bare keys + one presets file: labels and widgets come from presets, options/rules stay in the schema. */
export default function PresetsDemo() {
  const [locale, setLocale] = useState<'zh-CN' | 'en-US'>('zh-CN');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">Locale</span>
        <Radio.Group
          value={locale}
          onChange={(event) => setLocale(event.target.value)}
          optionType="button"
          options={[
            { label: '中文', value: 'zh-CN' },
            { label: 'English', value: 'en-US' },
          ]}
        />
      </div>

      <SchemaForm
        meta={meta}
        presets={presets}
        locale={locale}
        classNames={classNames}
        onFinish={(values) => console.log('Submitted values:', values)}>
        <div className="col-span-full mt-2 flex justify-end">
          <Button htmlType="submit" type="primary">
            Submit
          </Button>
        </div>
      </SchemaForm>

      <div>
        <p className="mb-2 text-sm text-gray-500">
          schema 只写 key；label / widget 全部来自 presets。
        </p>
        <pre className="max-h-80 overflow-auto rounded bg-gray-100 p-4 text-xs">
          {JSON.stringify(meta, null, 2)}
        </pre>
      </div>
    </div>
  );
}
