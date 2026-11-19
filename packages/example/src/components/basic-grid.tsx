import { Button, Form, message } from 'antd';
import { useFormSchema } from '@jswork/antd-form-schema';
import { basicMeta } from '../meta';

/** PRD §10.1: two-column Tailwind grid; layout lives in JSX, not in the schema. */
export default function BasicGrid() {
  const [form] = Form.useForm();
  const { visibleFields } = useFormSchema(basicMeta, form);

  return (
    <Form
      form={form}
      initialValues={basicMeta.initialValues}
      layout="vertical"
      onFinish={(values) => message.success(`Submitted: ${JSON.stringify(values)}`)}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {visibleFields.map((field) => (
          <div
            key={field.key}
            className={field.widget === 'textarea' ? 'md:col-span-2' : ''}
          >
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
      <div className="mt-6 flex justify-end gap-2">
        <Button htmlType="reset">Reset</Button>
        <Button type="primary" htmlType="submit">
          Submit
        </Button>
      </div>
    </Form>
  );
}
