import { Button, Form, message } from 'antd';
import { SchemaForm } from '@jswork/antd-form-schema';
import type { FormSlots } from '@jswork/antd-form-schema';
import { basicMeta } from '../meta';

/** Custom slots: label tooltip, unit beside control, red error text. */
const customSlots: FormSlots = {
  label: ({ field }) => (
    <label className="mb-1 block text-sm font-medium text-gray-700">
      <abbr title={`${String(field.label)}（鼠标悬停查看说明）`}>{String(field.label)}</abbr>
      {field.required && <span className="text-red-500"> *</span>}
    </label>
  ),
  control: ({ control, itemProps, field }) => (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <Form.Item {...itemProps} noStyle>{control}</Form.Item>
      </div>
      {field.key === 'age' && <span className="text-sm text-gray-500">岁</span>}
    </div>
  ),
  error: ({ errors }) => (errors.length > 0 ? <div className="mt-1 text-sm text-red-600">{errors.join('、')}</div> : null),
};

/** Slots demo: custom label / control / error, plus a default-rendered control group. */
export default function SlotsDemo() {
  return (
    <div className="space-y-10">
      <section>
        <h3 className="mb-1 text-base font-semibold">1. 自定义 slots</h3>
        <p className="mb-4 text-sm text-gray-500">
          label 带 tooltip、age 控件旁加单位、错误用红色文案；其余部件保持默认渲染。
        </p>
        <SchemaForm
          meta={basicMeta}
          slots={customSlots}
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
          itemClassName="rounded border p-3"
          controlClassName="w-full"
          onFinish={(values) => message.success(`Submitted: ${JSON.stringify(values)}`)}
        >
          <div className="mt-6 flex justify-end">
            <Button htmlType="submit" type="primary">Submit</Button>
          </div>
        </SchemaForm>
      </section>

      <section>
        <h3 className="mb-1 text-base font-semibold">2. 对照：不传 slots</h3>
        <p className="mb-4 text-sm text-gray-500">同一份 meta，不传 slots 时行为与之前完全一致。</p>
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
    </div>
  );
}
