import { Button, Form, message } from 'antd';
import { useFormSchema } from '@jswork/antd-form-schema';
import type { FormSchema } from '@jswork/antd-form-schema';

/** PRD §10.2: collapsible groups built from <details> and getField(key). */
const meta: FormSchema = {
  initialValues: { role: 'user' },
  fields: [
    { key: 'name', label: '姓名', widget: 'input' },
    { key: 'email', label: '邮箱', widget: 'input', required: true },
    { key: 'age', label: '年龄', widget: 'number' },
    { key: 'bio', label: '个人简介', widget: 'textarea' },
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
  ],
};

const groups = [
  { title: 'Basic info', keys: ['name', 'email', 'age'] },
  { title: 'Extended info', keys: ['bio', 'role', 'company'] },
];

export default function CardGroups() {
  const [form] = Form.useForm();
  const { getField } = useFormSchema(meta, form);

  return (
    <Form
      form={form}
      initialValues={meta.initialValues}
      layout="vertical"
      onFinish={(values) => message.success(`Saved: ${JSON.stringify(values)}`)}
    >
      <div className="space-y-4">
        {groups.map((group) => (
          <details key={group.title} className="rounded-lg border p-4" open>
            <summary className="cursor-pointer font-semibold">{group.title}</summary>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {group.keys.map((key) => {
                const field = getField(key);
                if (!field?.visible) return null;
                return (
                  <Form.Item key={key} {...field.itemProps} label={field.label}>
                    {field.control}
                  </Form.Item>
                );
              })}
            </div>
          </details>
        ))}
        <div className="flex justify-end gap-2">
          <Button htmlType="reset">Reset</Button>
          <Button type="primary" htmlType="submit">
            Save
          </Button>
        </div>
      </div>
    </Form>
  );
}
