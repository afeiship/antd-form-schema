import { useState } from 'react';
import { Button, Switch } from 'antd';
import { SchemaForm } from '@jswork/antd-form-schema';
import type { FieldConverter, FormSchema } from '@jswork/antd-form-schema';

/** cents in storage <-> yuan in the control */
const money: FieldConverter = {
  read: (value) => (value == null ? value : Number(value) / 100),
  write: (value) => (value == null ? value : Math.round(Number(value) * 100)),
};

/** 0.125 in storage <-> 12.5 in the control */
const ratio: FieldConverter = {
  read: (value) => (value == null ? value : Number(value) * 100),
  write: (value) => (value == null ? value : Number(value) / 100),
};

const converters = { money, ratio };

const meta: FormSchema = {
  initialValues: { price: 1999, discount: 0.125, note: 'plain value' },
  fields: [
    { key: 'price', label: 'Price (stored in cents)', widget: 'number', converter: 'money' },
    { key: 'discount', label: 'Discount (stored as ratio)', widget: 'number', converter: 'ratio' },
    { key: 'note', label: 'Note (no converter)' },
  ],
};

export default function ConvertersDemo() {
  const [viewMode, setViewMode] = useState(false);
  const [values, setValues] = useState<Record<string, any> | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Switch checked={viewMode} onChange={setViewMode} />
        View mode
      </div>

      <SchemaForm
        key={viewMode ? 'view' : 'edit'}
        meta={{ ...meta, viewMode }}
        converters={converters}
        onFinish={(formValues) => setValues(formValues)}
      >
        <Button type="primary" htmlType="submit">
          Submit
        </Button>
      </SchemaForm>

      <div className="text-sm">
        <div className="mb-1 font-medium">Stored values (after write)</div>
        <pre className="rounded bg-gray-50 p-3 text-xs">
          {values ? JSON.stringify(values, null, 2) : 'submit to inspect'}
        </pre>
      </div>
    </div>
  );
}
