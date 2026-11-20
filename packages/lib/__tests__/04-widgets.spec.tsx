import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it } from 'vitest';
import { applyConverter, resolveWidget, ViewSpan } from '../src/widgets';
import { BUILTIN_WIDGET_IDS } from '../src/widgets/widget-ids';
import { normalizeMeta } from '../src/core/normalize';
import type { FieldSchema } from '../src/core/types';

function convert(widget: string, overrides: Partial<FieldSchema> = {}) {
  const field = normalizeMeta({ fields: [{ key: 'x', widget, ...overrides }] }).fields[0];
  return applyConverter(field, resolveWidget(widget), { fields: [] });
}

const Rate = () => <div>rate</div>;
const MySelect = () => <div>my select</div>;

describe('resolveWidget', () => {
  it('resolves every builtin id to a component', () => {
    for (const id of BUILTIN_WIDGET_IDS) {
      expect(resolveWidget(id).component, id).toBeDefined();
    }
  });

  it('lets local widgets override builtin ids', () => {
    expect(resolveWidget('select', { select: { component: MySelect } }).component).toBe(MySelect);
  });

  it('returns a directly supplied component as-is', () => {
    expect(resolveWidget(Rate).component).toBe(Rate);
  });

  it('falls back to the input definition for unknown ids', () => {
    expect(resolveWidget('nope').component).toBe(resolveWidget('input').component);
  });
});

describe('metaConverter', () => {
  it('writes valuePropName=checked for checkbox, switch and radio', () => {
    for (const id of ['checkbox', 'switch', 'radio']) {
      expect(convert(id).valuePropName, id).toBe('checked');
    }
  });

  it('converts options into rendered children for radio-group and checkbox-group', () => {
    for (const id of ['radio-group', 'checkbox-group']) {
      const compiled = convert(id, { options: [['a', 'Apple'], ['b', 'Banana']] });
      const Comp = resolveWidget(id).component;
      const { container } = render(<Comp {...compiled.widgetProps} />);
      expect(within(container).getByText('Apple'), id).toBeInTheDocument();
      expect(within(container).getByText('Banana'), id).toBeInTheDocument();
    }
  });

  it('converts options into Select option children', () => {
    const compiled = convert('select', { options: [['a', 'Apple'], ['b', 'Banana']] });
    const Comp = resolveWidget('select').component;
    render(<Comp {...compiled.widgetProps} open virtual={false} />);
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('Banana')).toBeInTheDocument();
  });

  it('writes showTime for date-time', () => {
    expect(convert('date-time').widgetProps?.showTime).toBe(true);
  });

  it('shallow-merges widgetProps instead of replacing them', () => {
    const compiled = convert('date-time', { widgetProps: { placeholder: 'when' } });
    expect(compiled.widgetProps?.placeholder).toBe('when');
    expect(compiled.widgetProps?.showTime).toBe(true);
  });
});

describe('ViewSpan', () => {
  it('prefers initialValue over value', () => {
    render(<ViewSpan initialValue="first" value="second" />);
    expect(screen.getByText('first')).toBeInTheDocument();
  });

  it('shows the matching option label for a scalar value', () => {
    render(<ViewSpan initialValue="a" options={[{ value: 'a', label: 'Apple' }]} />);
    expect(screen.getByText('Apple')).toBeInTheDocument();
  });

  it('joins labels for an array value', () => {
    render(
      <ViewSpan
        initialValue={['a', 'b']}
        options={[{ value: 'a', label: 'Apple' }, { value: 'b', label: 'Banana' }]}
      />,
    );
    expect(screen.getByText('Apple, Banana')).toBeInTheDocument();
  });

  it('shows the raw value when no options are given', () => {
    render(<ViewSpan value={42} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders boolean values as text instead of omitting them', () => {
    const { container, rerender } = render(<ViewSpan initialValue={false} />);
    expect(screen.getByText('false')).toBeInTheDocument();
    expect(container.textContent).toBe('false');
    rerender(<ViewSpan initialValue={true} />);
    expect(screen.getByText('true')).toBeInTheDocument();
  });

  it('renders empty for null or undefined', () => {
    const { container, rerender } = render(<ViewSpan initialValue={null} />);
    expect(container.textContent).toBe('');
    rerender(<ViewSpan value={undefined} />);
    expect(container.textContent).toBe('');
  });
});

describe('valueType', () => {
  it('injects valueFormat for valueType string on date widgets', () => {
    expect(convert('date-picker', { valueType: 'string' }).widgetProps?.valueFormat).toBe('YYYY-MM-DD');
    expect(convert('date-time', { valueType: 'string' }).widgetProps?.valueFormat).toBe('YYYY-MM-DD');
  });

  it('allows valueFormat override with valueType string', () => {
    expect(convert('date-picker', { valueType: 'string', valueFormat: 'YYYY/MM/DD' }).widgetProps?.valueFormat).toBe('YYYY/MM/DD');
  });

  it('ignores valueType on non-date widgets', () => {
    expect(convert('input', { valueType: 'string' }).widgetProps).toBeUndefined();
  });

  it('ignores valueFormat without valueType string', () => {
    expect(convert('date-picker', { valueFormat: 'YYYY/MM/DD' }).widgetProps?.valueFormat).toBeUndefined();
  });

  it('does not inject valueFormat for dayjs (default)', () => {
    expect(convert('date-picker').widgetProps?.valueFormat).toBeUndefined();
    expect(convert('date-picker', { valueType: 'dayjs' }).widgetProps?.valueFormat).toBeUndefined();
  });
});
