import { Button, Form, Radio, message } from 'antd';
import { useFormSchema } from '@jswork/antd-form-schema';
import type { FormSchema, WidgetDef } from '@jswork/antd-form-schema';

/** Overriding a builtin widget with a new local id requires no library changes. */
const radioButton: WidgetDef = { component: Radio.Group };

const meta: FormSchema = {
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
      key: 'priority',
      label: '优先级',
      widget: 'radio-button',
      widgetProps: { optionType: 'button', buttonStyle: 'solid' },
      options: ['Low', 'Medium', 'High'],
    },
    { key: 'remark', label: '备注', widget: 'textarea' },
  ],
};

/** PRD §10.3: swap `select` for a button-style Radio.Group in JSX and register a new widget id. */
export default function CustomWidget() {
  const [form] = Form.useForm();
  const { visibleFields } = useFormSchema(meta, form, {
    widgets: { 'radio-button': radioButton },
  });

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={(values) => message.success(`Saved: ${JSON.stringify(values)}`)}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {visibleFields.map((field) => (
          <div
            key={field.key}
            className={field.widget === 'textarea' ? 'md:col-span-2' : ''}
          >
            <label className="mb-1 block text-sm font-medium text-gray-700">{field.label}</label>
            <Form.Item {...field.itemProps} noStyle>
              {field.widget === 'select' ? (
                <Radio.Group
                  options={field.controlProps.options}
                  optionType="button"
                  buttonStyle="solid"
                />
              ) : (
                field.control
              )}
            </Form.Item>
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-end">
        <Button type="primary" htmlType="submit">
          Submit
        </Button>
      </div>
    </Form>
  );
}
