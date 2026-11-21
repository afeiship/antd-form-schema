import { useEffect, useState } from 'react';
import { Button, Skeleton, Tag, message } from 'antd';
import { SchemaForm } from '@jswork/antd-form-schema';
import type { FormSchema } from '@jswork/antd-form-schema';
import { presets } from '../presets';

interface UserDetail {
  id: string;
  name: string;
  nickname: string;
  email: string;
  phone: string;
  role: 'admin' | 'user';
  status: 'active' | 'disabled';
  birthday: string;
  bio: string;
}

/** Detail payload as the API would return it. */
const MOCK_DETAIL: UserDetail = {
  id: 'U-1001',
  name: '林知夏',
  nickname: 'xia',
  email: 'xia.lin@example.com',
  phone: '13800001234',
  role: 'user',
  status: 'active',
  birthday: '1996-05-12',
  bio: '负责前端基础设施，喜欢把重复的事做成工具。',
};

/** Mock detail endpoint: swap this for a real request without touching the form. */
function fetchUserDetail(id: string): Promise<UserDetail> {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ ...MOCK_DETAIL, id }), 700);
  });
}

/** Custom view widget: status renders as a Tag instead of plain text. */
function StatusTag({ initialValue, options }: any) {
  const label =
    options?.find((option: any) => option.value === initialValue)?.label ?? initialValue;
  return <Tag color={initialValue === 'active' ? 'green' : 'default'}>{label}</Tag>;
}

/**
 * One schema for both states: fields are pure keys, labels and widgets come from presets.
 * Only `initialValues` and `viewMode` differ — the detail response feeds the same schema.
 */
const detailMeta: FormSchema = {
  name: 'user-detail-edit',
  view: { bordered: true, size: 'small', column: 2 },
  fields: [
    { key: 'name', required: true },
    { key: 'nickname' },
    { key: 'email', rules: [{ type: 'email', message: '邮箱格式不正确' }] },
    { key: 'phone' },
    {
      key: 'role',
      options: [
        ['admin', '管理员'],
        ['user', '普通用户'],
      ],
    },
    {
      key: 'status',
      options: [
        ['active', '活跃'],
        ['disabled', '禁用'],
      ],
      viewWidget: StatusTag,
    },
    { key: 'birthday', valueType: 'string' },
    { key: 'id' },
    { key: 'bio'},
  ],
};

export default function DetailEditDemo() {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchUserDetail('U-1001')
      .then((data) => {
        if (alive) setDetail(data);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <Skeleton active paragraph={{ rows: 6 }} />;

  if (!detail) {
    return (
      <p className="text-sm text-gray-500">
        未获取到详情。
        <Button type="link" onClick={() => window.location.reload()}>
          重试
        </Button>
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">用户详情</h3>
          <p className="mt-1 text-sm text-gray-500">
            {editing
              ? '表单已用详情数据初始化，提交后写回本地详情。'
              : '详情来自接口；点「编辑资料」把同一份数据装进 schema 表单。'}
          </p>
        </div>
        {!editing && (
          <Button type="primary" onClick={() => setEditing(true)}>
            编辑资料
          </Button>
        )}
      </div>

      <SchemaForm
        key={editing ? 'edit' : 'view'}
        meta={{ ...detailMeta, initialValues: detail, viewMode: !editing }}
        presets={presets}
        locale="zh-CN"
        classNames={
          editing
            ? {
                form: 'grid grid-cols-1 gap-4 md:grid-cols-2',
                field: 'rounded border p-3 !mb-0 hover:bg-gray-50',
                label: 'mb-1 block text-sm font-medium text-gray-700',
                control: 'w-full',
              }
            : undefined
        }
        onFinish={async (values) => {
          setSaving(true);
          await new Promise((resolve) => setTimeout(resolve, 600));
          setDetail({ ...detail, ...(values as Partial<UserDetail>) });
          setSaving(false);
          setEditing(false);
          message.success('已保存（示例未真正写库）');
        }}>
        {editing && (
          <div className="col-span-full mt-2 flex justify-end gap-2">
            <Button onClick={() => setEditing(false)} disabled={saving}>
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              保存
            </Button>
          </div>
        )}
      </SchemaForm>

      <p className="text-xs text-gray-400">
        同一份 schema 同时服务于查看与编辑：查看态自动用 Descriptions，编辑态用表单控件，字段定义不重复。
      </p>
    </div>
  );
}
