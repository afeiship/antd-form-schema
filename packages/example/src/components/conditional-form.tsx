import { Button, Form, message } from 'antd';
import { useFormSchema } from '@jswork/antd-form-schema';
import type { FormSchema } from '@jswork/antd-form-schema';

const meta: FormSchema = {
  initialValues: { role: 'user', customerType: '个人' },
  fields: [
    {
      key: 'role',
      label: '角色',
      widget: 'select',
      options: [
        { value: 'admin', label: '管理员' },
        { value: 'user', label: '普通用户' },
      ],
    },
    {
      key: 'company',
      label: '公司',
      widget: 'input',
      condition: { field: 'role', op: 'eq', value: 'admin' },
    },
    {
      key: 'customerType',
      label: '客户类型',
      widget: 'select',
      options: ['个人', '企业'],
    },
    { key: 'scale', label: '企业规模', widget: 'number' },
    {
      key: 'contactPolicy',
      label: '专属对接策略',
      widget: 'input',
      condition: {
        or: [
          { field: 'customerType', op: 'eq', value: '个人' },
          {
            and: [
              { field: 'customerType', op: 'eq', value: '企业' },
              { field: 'scale', op: 'gte', value: 100 },
            ],
          },
        ],
      },
    },
  ],
};

/** PRD §7.1: declarative conditions auto-watch dependencies; no onValuesChange needed. */
export default function ConditionalForm() {
  const [form] = Form.useForm();
  const { visibleFields } = useFormSchema(meta, form);

  return (
    <Form
      form={form}
      initialValues={meta.initialValues}
      layout="vertical"
      onFinish={(values) => message.success(`Saved: ${JSON.stringify(values)}`)}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {visibleFields.map((field) => (
          <div key={field.key}>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500"> *</span>}
            </label>
            <Form.Item {...field.itemProps} noStyle>
              {field.control}
            </Form.Item>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-gray-500">
        Try: role = admin shows Company; customerType = 企业 + scale ≥ 100 shows 专属对接策略
        (or 个人 alone).
      </p>
      <div className="mt-4 flex justify-end">
        <Button type="primary" htmlType="submit">
          Submit
        </Button>
      </div>
    </Form>
  );
}
