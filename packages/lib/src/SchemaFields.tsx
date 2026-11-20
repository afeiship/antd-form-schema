import { renderSlot } from '@jswork/react-list';
import { Form } from 'antd';
import type { FC, ReactNode } from 'react';
import { renderControl, renderField, renderLabel } from './slots';
import type { FormSlots } from './slots';
import { useFormSchema } from './useFormSchema';
import type { FormSchema, WidgetDef } from './types';

export interface SchemaFieldsProps {
  meta: FormSchema;
  widgets?: Record<string, WidgetDef>;
  className?: string;
  itemClassName?: string;
  labelClassName?: string;
  controlClassName?: string;
  slots?: FormSlots;
}

/** Field renderer: delegates label/required/error to antd Form.Item. */
const SchemaFields: FC<SchemaFieldsProps> = ({
  meta,
  widgets,
  className,
  itemClassName,
  labelClassName,
  controlClassName,
  slots,
}) => {
  const form = Form.useFormInstance();
  if (!form) throw new Error('SchemaFields must be used inside a <Form>.');
  const { visibleFields } = useFormSchema(meta, form, { widgets });

  return (
    <div className={className}>
      {visibleFields.map((field) => {
        const labelContent = slots?.label
          ? renderSlot(slots.label, { field }, field.key + '-label')
          : renderLabel({ field });
        const labelNode: ReactNode = labelClassName ? (
          <span className={labelClassName}>{labelContent}</span>
        ) : (
          labelContent
        );
        const control = slots?.control
          ? renderSlot(slots.control, { field, control: field.control }, field.key + '-control')
          : renderControl({ field, control: field.control });
        const item = (
          <Form.Item {...field.itemProps} label={labelNode} className={controlClassName} required={field.required}>
            {control}
          </Form.Item>
        );
        return slots?.field
          ? renderSlot(slots.field, { field, children: item }, field.key)
          : renderField({ field, children: item, className: itemClassName, key: field.key });
      })}
    </div>
  );
};

export default SchemaFields;
