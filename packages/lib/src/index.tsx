import cx from 'classnames';
import { ReactNode, FC, HTMLAttributes } from "react";

const CLASS_NAME = "antd-form-schema";

export type AntdFormSchemaProps = {
  /**
   * The extended className for component.
   * @default ''
   */
  className?: string;
  /**
   * The children element.
   */
  children?: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

type AntdFormSchemaComponent = FC<AntdFormSchemaProps> & { version?: string };

const AntdFormSchema: AntdFormSchemaComponent = ({ className, children, ...rest }) => (
  <div {...rest} data-component={CLASS_NAME} className={cx(CLASS_NAME, className)}>
    {children}
  </div>
);

AntdFormSchema.displayName = CLASS_NAME;
AntdFormSchema.version = __VERSION__;

export default AntdFormSchema;
