import { renderSlot } from '@jswork/react-list';
import { Form } from 'antd';
import { cloneElement, isValidElement } from 'react';
import type { FC, ReactElement, ReactNode } from 'react';
import type { FormClassNames } from '../widgets/class-names';
import { mergeClasses, warnIneffectiveClassNames } from '../widgets/class-names';
import { renderControl, renderLabel } from './slots';
import type { FormSlots } from './slots';
import { useFormSchema } from '../useFormSchema';
import type { FormSchema, WidgetDef } from '../core/types';

export interface SchemaFieldsProps {
  meta: FormSchema;
  widgets?: Record<string, WidgetDef>;
  classNames?: FormClassNames;
  slots?: FormSlots;
}

/** Merge an extra className onto a React element without replacing its own classes. */
function withClassName(node: ReactNode, className: string): ReactNode {
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<any>;
  return cloneElement(element, { className: mergeClasses(element.props.className, className) });
}

/** Field renderer: delegates label/required/error to antd Form.Item. */
const SchemaFields: FC<SchemaFieldsProps> = ({ meta, widgets, classNames, slots }) => {
  const form = Form.useFormInstance();
  if (!form) throw new Error('SchemaFields must be used inside a <Form>.');
  if (classNames?.form) warnIneffectiveClassNames(classNames.form);
  const { visibleFields } = useFormSchema(meta, form, { widgets });

  return (
    <>
      {visibleFields.map((field) => {
        const labelContent = slots?.label
          ? renderSlot(slots.label, { field }, field.key + '-label')
          : renderLabel({ field });
        const labelNode: ReactNode = classNames?.label ? (
          <span className={classNames.label}>{labelContent}</span>
        ) : (
          labelContent
        );
        const control = slots?.control
          ? renderSlot(slots.control, { field, control: field.control }, field.key + '-control')
          : renderControl({ field, control: field.control });
        const controlClass = mergeClasses(field.className, classNames?.control);
        const finalControl = controlClass ? withClassName(control, controlClass) : control;
        const item = (
          <Form.Item
            {...field.itemProps}
            key={field.key}
            label={labelNode}
            className={classNames?.field}
            required={field.required}
          >
            {finalControl}
          </Form.Item>
        );
        return slots?.field ? renderSlot(slots.field, { field, children: item }, field.key) : item;
      })}
    </>
  );
};

export default SchemaFields;
