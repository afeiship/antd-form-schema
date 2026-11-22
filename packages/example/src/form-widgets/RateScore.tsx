import { Rate } from 'antd';
import type { WidgetComponentProps } from '@jswork/antd-form-schema';

/** 评分控件：数字值，allowHalf 经 widgetProps / metaConverter 透传。 */
export function RateScore({ value, onChange, disabled, readOnly, ...rest }: WidgetComponentProps) {
  return (
    <Rate
      value={value ?? 0}
      disabled={disabled || readOnly}
      onChange={(next) => onChange?.(next)}
      {...rest}
    />
  );
}
