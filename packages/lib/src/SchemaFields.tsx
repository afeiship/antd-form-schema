import { renderSlot } from '@jswork/react-list';
import { Form } from 'antd';
import type { FC } from 'react';
import { renderControl, renderError, renderField, renderLabel } from './slots';
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

/** Field renderer: reads the form from context, renders a className-driven grid of labelled fields. */
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
        const body = (
          <>
            {slots?.label
              ? renderSlot(slots.label, { field }, field.key + '-label')
              : renderLabel({ field, className: labelClassName })}
            {slots?.control
              ? renderSlot(
                  slots.control,
                  { field, control: field.control, itemProps: field.itemProps },
                  field.key + '-control',
                )
              : renderControl({
                  field,
                  control: field.control,
                  itemProps: field.itemProps,
                  className: controlClassName,
                })}
            <Form.Item noStyle shouldUpdate>
              {() => {
                const errors = form.getFieldError(field.name);
                return slots?.error
                  ? renderSlot(slots.error, { field, errors }, field.key + '-error')
                  : renderError({ field, errors });
              }}
            </Form.Item>
          </>
        );

        return slots?.field
          ? renderSlot(slots.field, { field, children: body }, field.key)
          : renderField({ field, children: body, className: itemClassName, key: field.key });
      })}
    </div>
  );
};

export default SchemaFields;
