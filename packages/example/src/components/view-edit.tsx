import { useMemo, useState } from 'react';
import { Button, Checkbox, Form, message } from 'antd';
import { useFormSchema } from '@jswork/antd-form-schema';
import type { FormSchema } from '@jswork/antd-form-schema';

const meta: FormSchema = {
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
    { key: 'bio', label: '个人简介', widget: 'textarea' },
  ],
};

/** PRD §8: one schema, two presentations; enum values display their option labels in view mode. */
export default function ViewEdit() {
  const [form] = Form.useForm();
  const [viewMode, setViewMode] = useState(false);
  const viewMeta = useMemo(() => ({ ...meta, viewMode }), [viewMode]);
  const { visibleFields } = useFormSchema(viewMeta, form);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Checkbox checked={viewMode} onChange={(e) => setViewMode(e.target.checked)}>
          View mode
        </Checkbox>
        <span className="text-sm text-gray-500">
          {viewMode ? 'Read-only text (enum shows label)' : 'Editable controls'}
        </span>
      </div>
      <Form
        form={form}
        initialValues={{ name: 'Alice', role: 'admin', bio: 'Hello world' }}
        layout="vertical"
        onFinish={(values) => message.success(`Saved: ${JSON.stringify(values)}`)}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visibleFields.map((field) => (
            <div key={field.key} className={field.widget === 'textarea' ? 'md:col-span-2' : ''}>
              <Form.Item {...field.itemProps} label={field.label} required={field.required}>
                {viewMode ? (field.viewContent ?? field.control) : field.control}
              </Form.Item>
            </div>
          ))}
        </div>
        {!viewMode && (
          <div className="mt-6 flex justify-end">
            <Button type="primary" htmlType="submit">
              Submit
            </Button>
          </div>
        )}
      </Form>
    </div>
  );
}
