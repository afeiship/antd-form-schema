import { Select } from 'antd';
import type { WidgetComponentProps } from '@jswork/antd-form-schema';

/** 城市选择：注册表简写组件，接收值绑定与派生属性。 */
export function CitySelector({ value, onChange, options, placeholder, disabled }: WidgetComponentProps) {
  return (
    <Select
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      options={options}
      allowClear
      onChange={(next) => onChange?.(next)}
    />
  );
}
