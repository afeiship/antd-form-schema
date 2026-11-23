import { Descriptions, Form } from 'antd';
import type { DescriptionsProps } from 'antd';
import { cloneElement, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import cx from 'classnames';
import { renderSlot } from '@jswork/react-list';
import type { FormClassNames } from '../widgets/class-names';
import { renderControl, renderLabel } from './slots';
import type { FormSlots } from './slots';
import type { BoundField, ViewConfig } from '../core/types';

export interface SchemaViewProps {
  fields: BoundField[];
  view?: ViewConfig;
  slots?: FormSlots;
  classNames?: FormClassNames;
}

const DEFAULT_VIEW: Required<Pick<ViewConfig, 'column' | 'bordered' | 'size'>> = {
  column: 2,
  bordered: true,
  size: 'small',
};

/** Merge an extra className onto a React element without replacing its own classes. */
function withClassName(node: ReactNode, className?: string): ReactNode {
  if (!className || !isValidElement(node)) return node;
  const element = node as ReactElement<any>;
  return cloneElement(element, { className: cx(element.props.className, className) });
}

/** Descriptions-based view renderer: visible fields become items, hidden fields stay as Form.Items. */
export function SchemaView({ fields, view, slots, classNames }: SchemaViewProps) {
  const visibleFields = fields.filter((field) => field.visible);
  const hiddenFields = fields.filter((field) => field.hidden);

  return (
    <>
      <Descriptions
        title={view?.title as DescriptionsProps['title']}
        extra={view?.extra as DescriptionsProps['extra']}
        column={view?.column ?? DEFAULT_VIEW.column}
        bordered={view?.bordered ?? DEFAULT_VIEW.bordered}
        size={view?.size ?? DEFAULT_VIEW.size}
        layout={view?.layout}
        colon={view?.colon}
        className={view?.className}
      >
        {visibleFields.map((field) => {
          const labelContent = slots?.label
            ? renderSlot(slots.label, { field }, field.key + '-label')
            : renderLabel({ field });
          const labelNode: ReactNode = classNames?.label ? (
            <span className={classNames.label}>{labelContent}</span>
          ) : (
            labelContent
          );
          const content = slots?.control
            ? renderSlot(
                slots.control,
                { field, control: field.viewContent ?? field.control },
                field.key + '-control',
              )
            : renderControl({ field, control: field.viewContent ?? field.control });
          const contentNode = withClassName(content, classNames?.control);

          return (
            <Descriptions.Item
              key={field.key}
              label={labelNode}
              span={field.viewSpan}
              className={cx(classNames?.field, field.className)}
            >
              {contentNode}
            </Descriptions.Item>
          );
        })}
      </Descriptions>

      {/* Visible fields have no Form.Item in view mode; mount value-only carriers so submit keeps them. */}
      {visibleFields.map((field) => (
        <Form.Item
          {...field.itemProps}
          key={`carrier-${field.key}`}
          rules={[]}
          noStyle
        />
      ))}

      {hiddenFields.map((field) => (
        <Form.Item {...field.itemProps} key={field.key} hidden>
          {field.control}
        </Form.Item>
      ))}
    </>
  );
}

export default SchemaView;
