import { Input, Space, Tag } from 'antd';
import { useState } from 'react';
import type { WidgetComponentProps } from '@jswork/antd-form-schema';

interface TagInputProps extends WidgetComponentProps {
  /** 最多标签数，默认 5。 */
  max?: number;
}

/** 标签输入：定义对象注册的组件，max 经 widgetProps 透传。 */
export function TagInput({ value, onChange, disabled, readOnly, placeholder, max = 5 }: TagInputProps) {
  const tags: string[] = Array.isArray(value) ? value : value == null ? [] : [String(value)];
  const [draft, setDraft] = useState('');

  const emit = (next: string[]) => onChange?.(next.slice(0, max));

  const add = () => {
    const next = draft.trim();
    if (!next || tags.includes(next)) return;
    emit([...tags, next]);
    setDraft('');
  };

  return (
    <Space wrap>
      {tags.map((tag) => (
        <Tag
          key={tag}
          closable={!disabled && !readOnly}
          onClose={() => emit(tags.filter((t) => t !== tag))}
        >
          {tag}
        </Tag>
      ))}
      {tags.length < max && (
        <Input
          size="small"
          style={{ width: 120 }}
          placeholder={placeholder ?? '输入后回车'}
          value={draft}
          disabled={disabled || readOnly}
          onChange={(e) => setDraft(e.target.value)}
          onPressEnter={add}
        />
      )}
    </Space>
  );
}
