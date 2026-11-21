import { Button, Form, message } from 'antd';
import { SchemaFields, SchemaForm } from '@jswork/antd-form-schema';
import { basicMeta } from '../meta';

const classNames = {
  form: 'grid grid-cols-1 gap-4 md:grid-cols-2',
  field: 'rounded border p-3 !mb-0 hover:bg-gray-50',
  label: 'mb-1 block text-sm font-medium text-gray-700',
  control: 'w-full',
};

/** Quick Form: the one-line path (SchemaForm) and the external-form path (SchemaFields). */
export default function SchemaFormDemo() {
  const [form] = Form.useForm();

  return (
    <div className="space-y-10">
      <section>
        <h3 className="mb-1 text-base font-semibold">1. SchemaForm — one line</h3>
        <p className="mb-4 text-sm text-gray-500">
          内部创建 Form；classNames.form 直接加在 &lt;Form&gt; 上，字段成为 grid item。
        </p>
        <SchemaForm
          labelCol={{ span: 4 }} // 等价于你说的 labelWidth
          wrapperCol={{ span: 20 }}
          colon={false}
          meta={basicMeta}
          classNames={classNames}
          onFinish={(values) => console.log(`Submitted values:`, values)}>
          <div className="col-span-full mt-6 flex justify-end">
            <Button htmlType="submit" type="primary">
              Submit
            </Button>
          </div>
        </SchemaForm>
      </section>

      <section>
        <h3 className="mb-1 text-base font-semibold">2. SchemaFields — external form</h3>
        <p className="mb-4 text-sm text-gray-500">
          Form 由使用者持有；classNames.form 在这里无效（控制台会提示），容器需自己写。
        </p>
        <Form
          form={form}
          initialValues={basicMeta.initialValues}
          onFinish={(values) => message.success(`Submitted: ${JSON.stringify(values)}`)}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SchemaFields
              meta={basicMeta}
              classNames={{
                field: classNames.field,
                label: classNames.label,
                control: classNames.control,
              }}
            />
          </div>
          <div className="mt-6 flex justify-end">
            <Button htmlType="submit" type="primary">
              Submit
            </Button>
          </div>
        </Form>
      </section>
    </div>
  );
}
