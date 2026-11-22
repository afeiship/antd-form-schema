import { useState } from 'react';
import { Button, message } from 'antd';
import { SchemaForm } from '@jswork/antd-form-schema';
import type { FormSchema } from '@jswork/antd-form-schema';

const meta: FormSchema = {
  initialValues: { city: 'wuhan', tags: ['React'], score: 4.5, flag: true },
  fields: [
    {
      key: 'city',
      label: '城市',
      widget: 'city-selector',
      placeholder: '请选择城市',
      options: [
        ['wuhan', '武汉'],
        ['beijing', '北京'],
        ['shanghai', '上海'],
      ],
    },
    {
      key: 'tags',
      label: '技能标签',
      widget: 'tag-input',
      widgetProps: { max: 6 },
      placeholder: '输入标签后回车',
    },
    {
      key: 'score',
      label: '评分',
      widget: 'rate-score',
      widgetProps: { allowHalf: true },
    },
    { key: 'flag', label: '启用', widget: 'flag-switch' },
  ],
};

/** 自定义组件在项目入口注册，schema 只写字符串 id。 */
export default function CustomWidgetsDemo() {
  const [values, setValues] = useState<Record<string, any> | null>(null);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        自定义组件在 <code>form-widgets</code> 注册表统一注册，schema 只写字符串 id：
        <code>city-selector</code> 为裸组件简写，<code>tag-input</code> / <code>rate-score</code> /{' '}
        <code>flag-switch</code> 为带 <code>metaConverter</code> 的定义对象。
      </p>

      <SchemaForm
        meta={meta}
        classNames={{ form: 'grid grid-cols-1 gap-4 md:grid-cols-2' }}
        onFinish={(formValues) => {
          setValues(formValues);
          message.success(`Saved: ${JSON.stringify(formValues)}`);
        }}
      >
        <div className="col-span-full flex justify-end">
          <Button htmlType="submit" type="primary">
            Submit
          </Button>
        </div>
      </SchemaForm>

      <pre className="rounded bg-gray-50 p-3 text-xs">
        {values ? JSON.stringify(values, null, 2) : 'submit to inspect'}
      </pre>
    </div>
  );
}
