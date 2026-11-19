import type { FormSchema } from '@jswork/antd-form-schema';

/** Shared schema from PRD §4.4: semantics only, no layout or style keys. */
export const basicMeta: FormSchema = {
  name: 'user-form',
  initialValues: { role: 'user' },
  fields: [
    { key: 'name', label: '姓名', widget: 'input', required: true, placeholder: '请输入姓名' },
    {
      key: 'email',
      label: '邮箱',
      widget: 'input',
      rules: [{ type: 'email', message: '邮箱格式不正确' }],
    },
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
    {
      key: 'skills',
      label: '技能',
      widget: 'select',
      widgetProps: { mode: 'multiple' },
      options: ['React', 'Node', 'Go'],
    },
    { key: 'birthday', label: '生日', widget: 'date-picker' },
    { key: 'notify', label: '接收通知', widget: 'switch' },
    { key: 'agree', label: '同意协议', widget: 'checkbox', required: true },
  ],
};
