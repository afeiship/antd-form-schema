import { renderSlot } from '@jswork/react-list';
import { Form, Spin } from 'antd';
import { cloneElement, isValidElement } from 'react';
import type { FC, ReactElement, ReactNode } from 'react';
import type { FormClassNames } from '../widgets/class-names';
import { mergeClasses, warnIneffectiveClassNames } from '../widgets/class-names';
import { renderControl, renderLabel } from './slots';
import type { FormSlots } from './slots';
import { useFormSchema } from '../useFormSchema';
import { useResolvedMeta } from './use-resolved-meta';
import type { FormSchema, Presets, WidgetDef } from '../core/types';

export interface SchemaFieldsProps {
  /** Sync schema, or a promise resolving to one (placeholders render until resolve). */
  meta: FormSchema | Promise<FormSchema>;
  widgets?: Record<string, WidgetDef>;
  classNames?: FormClassNames;
  slots?: FormSlots;
  /** Per-key presets: widget and locale-aware label. */
  presets?: Presets;
  /** Locale used to pick preset labels; defaults to 'zh-CN'. */
  locale?: string;
  /** Placeholder while async meta is pending; pass null to render nothing (default: antd Spin). */
  loading?: ReactNode;
  /** Placeholder when async meta rejects (default: nothing). */
  error?: ReactNode;
}

/** Merge an extra className onto a React element without replacing its own classes. */
function withClassName(node: ReactNode, className: string): ReactNode {
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<any>;
  return cloneElement(element, { className: mergeClasses(element.props.className, className) });
}

/** Field renderer: delegates label/required/error to antd Form.Item. */
const SchemaFields: FC<SchemaFieldsProps> = ({
  meta,
  widgets,
  classNames,
  slots,
  presets,
  locale,
  loading,
  error,
}) => {
  const { meta: resolved, error: resolvedError, pending } = useResolvedMeta(meta);
  // Hooks must run unconditionally (React rules of hooks); placeholders decide below.
  const form = Form.useFormInstance();
  if (!form) throw new Error('SchemaFields must be used inside a <Form>.');
  const { visibleFields } = useFormSchema(resolved ?? { fields: [] }, form, {
    widgets,
    presets,
    locale,
  });
  if (pending) return loading === undefined ? <Spin /> : loading;
  if (resolvedError) return error === undefined ? null : error;
  if (classNames?.form) warnIneffectiveClassNames(classNames.form);

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
        const controlClass = mergeClasses(classNames?.control, field.className);
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
