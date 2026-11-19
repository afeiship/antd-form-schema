import { Button, Form, message } from 'antd';
import { SchemaFields, SchemaForm } from '@jswork/antd-form-schema';
import { basicMeta } from '../meta';

/** Quick-form demo: one-line SchemaForm and external-form SchemaFields side by side. */
export default function SchemaFormDemo() {
  const [form] = Form.useForm();

  return (
    <div className="space-y-10">
      <section>
        <h3 className="mb-1 text-base font-semibold">1. SchemaForm — one line, internal form</h3>
        <p className="mb-4 text-sm text-gray-500">初值来自 meta.initialValues；提交按钮由 children 追加在字段网格之后。</p>
        <SchemaForm
          meta={basicMeta}
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
          itemClassName="rounded border p-3"
          labelClassName="mb-1 block text-sm font-medium text-gray-700"
          controlClassName="w-full"
          onFinish={(values) => message.success(`Submitted: ${JSON.stringify(values)}`)}
        >
          <div className="mt-6 flex justify-end">
            <Button htmlType="submit" type="primary">Submit</Button>
          </div>
        </SchemaForm>
      </section>

      <section>
        <h3 className="mb-1 text-base font-semibold">2. SchemaFields — external form, full control</h3>
        <p className="mb-4 text-sm text-gray-500">Form 由使用者持有，字段渲染与布局仍由 className 控制。</p>
        <Form form={form} initialValues={basicMeta.initialValues} layout="vertical" onFinish={(values) => message.success(`Submitted: ${JSON.stringify(values)}`)}>
          <SchemaFields meta={basicMeta} className="grid grid-cols-1 gap-4 md:grid-cols-2" itemClassName="..." labelClassName="mb-1 block text-sm font-medium text-gray-700" controlClassName="w-full" />
          <div className="mt-6 flex justify-end">
            <Button htmlType="submit" type="primary">Submit</Button>
          </div>
        </Form>
      </section>
    </div>
  );
}
