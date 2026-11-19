import { Button, Form, message } from 'antd';
import { useFormSchema } from '@jswork/antd-form-schema';
import type { FormSchema, BoundField } from '@jswork/antd-form-schema';

/** Step state is data, not layout; visibility conditions are declarative. No Form.List needed. */
const meta: FormSchema = {
  initialValues: { step: 1, name: '', email: '' },
  fields: [
    { key: 'step', widget: 'input', initialValue: 1 },
    {
      key: 'name',
      label: '姓名',
      widget: 'input',
      required: true,
      condition: { field: 'step', op: 'eq', value: 1 },
    },
    {
      key: 'email',
      label: '邮箱',
      widget: 'input',
      rules: [{ type: 'email', message: '邮箱格式不正确' }],
      condition: { field: 'step', op: 'eq', value: 1 },
    },
    {
      key: 'company',
      label: '公司',
      widget: 'input',
      condition: { field: 'step', op: 'eq', value: 2 },
    },
    {
      key: 'role',
      label: '角色',
      widget: 'select',
      options: ['管理员', '普通用户'],
      condition: { field: 'step', op: 'eq', value: 2 },
    },
  ],
};

function renderFields(fields: BoundField[]) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {fields.map((field) => (
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
  );
}

/** Two steps via conditional visibility + separate JSX blocks; step field is driven by form values. */
export default function StepForm() {
  const [form] = Form.useForm();
  const { visibleFields } = useFormSchema(meta, form);
  const step = Number(form.getFieldValue('step') ?? 1);

  const step1Fields = visibleFields.filter((field) => ['name', 'email'].includes(field.key));
  const step2Fields = visibleFields.filter((field) => ['company', 'role'].includes(field.key));

  return (
    <Form
      form={form}
      initialValues={meta.initialValues}
      layout="vertical"
      onFinish={(values) => message.success(`Completed: ${JSON.stringify(values)}`)}
    >
      <div className="mb-4 flex items-center gap-3">
        <span className={`text-sm font-medium ${step === 1 ? 'text-blue-600' : 'text-gray-400'}`}>
          1. Basic
        </span>
        <span className="h-px flex-1 bg-gray-200" />
        <span className={`text-sm font-medium ${step === 2 ? 'text-blue-600' : 'text-gray-400'}`}>
          2. Details
        </span>
      </div>

      {step === 1 && (
        <div className="rounded-lg border p-4">
          <h3 className="mb-4 font-semibold">Step 1: Basic info</h3>
          {renderFields(step1Fields)}
          <div className="mt-6 flex justify-end">
            <Button
              type="primary"
              onClick={async () => {
                try {
                  await form.validateFields(['name', 'email']);
                  form.setFieldValue('step', 2);
                } catch {
                  // antd renders inline errors; stay on the current step
                }
              }}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="rounded-lg border p-4">
          <h3 className="mb-4 font-semibold">Step 2: Details</h3>
          {renderFields(step2Fields)}
          <div className="mt-6 flex justify-between">
            <Button onClick={() => form.setFieldValue('step', 1)}>Back</Button>
            <Button type="primary" htmlType="submit">
              Finish
            </Button>
          </div>
        </div>
      )}
    </Form>
  );
}
