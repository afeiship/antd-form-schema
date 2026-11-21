import { useState } from 'react';
import { Button, Checkbox, message } from 'antd';
import { SchemaForm } from '@jswork/antd-form-schema';
import type { FormSchema } from '@jswork/antd-form-schema';

const meta: FormSchema = {
  view: { bordered: true, size: 'small', column: 2 },
  initialValues: { name: 'Alice', role: 'admin', bio: 'Hello world' },
  fields: [
    { key: 'name', label: '姓名', widget: 'input' },
    {
      key: 'role',
      label: '角色',
      widget: 'select',
      options: [
        { value: 'admin', label: '管理员' },
        { value: 'user', label: '普通用户' },
      ],
    },
    { key: 'bio', label: '个人简介', widget: 'textarea', viewSpan: 2 },
  ],
};

/** PRD §8: one schema, two presentations; view mode renders a Descriptions grid. */
export default function ViewEdit() {
  const [viewMode, setViewMode] = useState(false);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Checkbox checked={viewMode} onChange={(e) => setViewMode(e.target.checked)}>
          View mode
        </Checkbox>
        <span className="text-sm text-gray-500">
          {viewMode ? 'Descriptions grid (enum shows label)' : 'Editable controls'}
        </span>
      </div>
      <SchemaForm
        key={viewMode ? 'view' : 'edit'}
        meta={{ ...meta, viewMode }}
        onFinish={(values) => message.success(`Saved: ${JSON.stringify(values)}`)}>
        {!viewMode && (
          <div className="mt-6 flex justify-end">
            <Button type="primary" htmlType="submit">
              Submit
            </Button>
          </div>
        )}
      </SchemaForm>
    </div>
  );
}
