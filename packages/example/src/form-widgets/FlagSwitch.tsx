import { Switch } from 'antd';
import type { WidgetComponentProps } from '@jswork/antd-form-schema';

/** 开关控件：checked 绑定，valuePropName 由注册处 metaConverter 声明。 */
export function FlagSwitch({ checked, onChange, disabled, readOnly }: WidgetComponentProps) {
  return (
    <Switch
      checked={!!checked}
      disabled={disabled || readOnly}
      onChange={(next) => onChange?.(next)}
    />
  );
}
