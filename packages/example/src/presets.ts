import type { Presets } from '@jswork/antd-form-schema';

/**
 * One file for every key: widget once, labels per locale.
 * Fields keep only semantic keys; options / rules / placeholders stay in the schema.
 */
export const presets: Presets = {
  fields: {
    title: 'input',
    name: 'input',
    nickname: 'input',
    email: 'input',
    phone: 'input',
    avatar: 'input',
    status: 'select',
    role: 'select',
    bio: 'textarea',
    birthday: 'date-picker',
    createdAt: 'date-time',
    enabled: 'switch',
  },
  labels: {
    'zh-CN': {
      title: '标题',
      name: '姓名',
      nickname: '昵称',
      email: '邮箱',
      phone: '手机号',
      avatar: '头像地址',
      status: '状态',
      role: '角色',
      bio: '个人简介',
      birthday: '生日',
      createdAt: '创建时间',
      enabled: '是否启用',
    },
    'en-US': {
      title: 'Title',
      name: 'Name',
      nickname: 'Nickname',
      email: 'Email',
      phone: 'Phone',
      avatar: 'Avatar URL',
      status: 'Status',
      role: 'Role',
      bio: 'Bio',
      birthday: 'Birthday',
      createdAt: 'Created At',
      enabled: 'Enabled',
    },
  },
};

/** Full form schema: bare keys only, plus the semantic bits presets do not own. */
export const profileMeta = {
  name: 'profile-form',
  initialValues: { status: 'active', role: 'user', enabled: true },
  fields: [
    { key: 'title' },
    { key: 'name', required: true },
    { key: 'nickname' },
    { key: 'email', rules: [{ type: 'email', message: '邮箱格式不正确' }] },
    { key: 'phone' },
    { key: 'avatar', placeholder: 'https://example.com/avatar.png' },
    {
      key: 'status',
      options: [
        ['active', '活跃'],
        ['disabled', '禁用'],
      ],
    },
    {
      key: 'role',
      options: [
        ['admin', '管理员'],
        ['user', '普通用户'],
      ],
    },
    { key: 'bio' },
    { key: 'birthday', valueType: 'string' },
    { key: 'createdAt', valueType: 'timestamp' },
    { key: 'enabled' },
  ],
};
