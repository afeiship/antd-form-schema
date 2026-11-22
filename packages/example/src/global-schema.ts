import { configureSchemaForm } from '@jswork/antd-form-schema';
import type { FieldConverter, Presets } from '@jswork/antd-form-schema';
import { CitySelector } from './components/CitySelector';
import { TagInput } from './components/TagInput';

/** Project-wide field dictionary: schema only writes the semantic key. */
export const globalPresets: Presets = {
  fields: {
    title: 'input',
    status: 'select',
    price: 'number',
    discount: 'number',
  },
  labels: {
    'zh-CN': {
      title: '标题',
      status: '状态',
      price: '金额（元）',
      discount: '折扣（%）',
    },
    'en-US': {
      title: 'Title',
      status: 'Status',
      price: 'Amount (CNY)',
      discount: 'Discount (%)',
    },
  },
};

/** storage cents -> control yuan */
const money: FieldConverter = {
  read: (value) => (value == null ? value : Number(value) / 100),
  write: (value) => (value == null ? value : Math.round(Number(value) * 100)),
};

/** storage ratio -> control percent */
const ratio: FieldConverter = {
  read: (value) => (value == null ? value : Number(value) * 100),
  write: (value) => (value == null ? value : Number(value) / 100),
};

export const globalConverters = { money, ratio };

export const globalWidgets = {
  // 简写：裸组件，归一化为 { component: CitySelector }
  'city-selector': CitySelector,
  // 定义对象：组件 + 可选 metaConverter
  'tag-input': {
    component: TagInput,
    metaConverter: ({ field }) => ({
      widgetProps: { max: 5, ...field.widgetProps },
    }),
  },
};

configureSchemaForm({
  locale: 'zh-CN',
  presets: globalPresets,
  converters: globalConverters,
  widgets: globalWidgets,
});
