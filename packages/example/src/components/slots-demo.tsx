import { Button, message } from 'antd';
import { SchemaForm } from '@jswork/antd-form-schema';
import type { FormSlots } from '@jswork/antd-form-schema';
import { basicMeta } from '../meta';

/** Custom slots: label tooltip and a unit beside the control. antd Form.Item still owns the <label>, required mark and errors. */
const customSlots: FormSlots = {
  label: ({ field }) => (
    <abbr title={`${String(field.label)}（鼠标悬停查看说明）`}>{String(field.label)}</abbr>
  ),
  control: ({ control, field }) => (
    <div className="flex items-center gap-2">
      <div className="flex-1">{control}</div>
      {field.key === 'age' && <span className="text-sm text-gray-500">岁</span>}
    </div>
  ),
};

export default function SlotsDemo() {
  return (
    <div className="space-y-10">
      <section>
        <h3 className="mb-1 text-base font-semibold">1. 自定义 slots</h3>
        <p className="mb-4 text-sm text-gray-500">
          label 带 tooltip、age 控件旁加单位；label 的 htmlFor、必填星号与错误文案仍由 antd Form.Item 负责。
        </p>
        <SchemaForm
          meta={basicMeta}
          slots={customSlots}
          classNames={{
            form: 'grid grid-cols-1 gap-4 md:grid-cols-2',
            field: 'rounded border p-3',
            control: 'w-full',
          }}
          onFinish={(values) => message.success(`Submitted: ${JSON.stringify(values)}`)}
        >
          <div className="mt-6 flex justify-end">
            <Button htmlType="submit" type="primary">Submit</Button>
          </div>
        </SchemaForm>
      </section>

      <section>
        <h3 className="mb-1 text-base font-semibold">2. 对照：不传 slots</h3>
        <p className="mb-4 text-sm text-gray-500">同一份 meta，不传 slots 时完全走 antd Form.Item 默认渲染。</p>
        <SchemaForm
          meta={basicMeta}
          classNames={{
            form: 'grid grid-cols-1 gap-4 md:grid-cols-2',
            field: 'rounded border p-3',
            label: 'text-sm font-medium text-gray-700',
            control: 'w-full',
          }}
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
