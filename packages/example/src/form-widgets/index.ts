import type { WidgetInput } from '@jswork/antd-form-schema';
import { CitySelector } from './CitySelector';
import { TagInput } from './TagInput';
import { RateScore } from './RateScore';
import { FlagSwitch } from './FlagSwitch';

export { CitySelector, TagInput, RateScore, FlagSwitch };

/**
 * 项目级自定义控件注册表：字符串 id → 组件 / 定义对象。
 * - 裸组件为简写，归一化为 `{ component }`；
 * - 定义对象可带 `metaConverter`（合并 widgetProps / 声明 valuePropName）。
 */
export const globalWidgets: Record<string, WidgetInput> = {
  // 简写：裸组件
  'city-selector': CitySelector,
  // 定义对象：组件 + metaConverter，合并 widgetProps
  'tag-input': {
    component: TagInput,
    metaConverter: ({ field }) => ({
      widgetProps: { max: 5, ...field.widgetProps },
    }),
  },
  'rate-score': {
    component: RateScore,
    metaConverter: ({ field }) => ({
      widgetProps: { allowHalf: true, ...field.widgetProps },
    }),
  },
  // 定义对象：checked 绑定，声明 valuePropName
  'flag-switch': {
    component: FlagSwitch,
    metaConverter: () => ({ valuePropName: 'checked' }),
  },
};
