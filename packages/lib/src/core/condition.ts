import { get, toNamePath, uniqPaths } from '../core/utils';
import type { CompareCondition, Condition, ConditionFn, FieldSchema, NamePath } from './types';

type ConditionContext = { form: any; values?: Record<string, any> };

function isEmpty(value: any): boolean {
  if (value == null || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

function compare(actual: any, expected: any, op: 'gt' | 'gte' | 'lt' | 'lte'): boolean {
  const leftNumber = Number(actual);
  const rightNumber = Number(expected);
  const numeric = !Number.isNaN(leftNumber) && !Number.isNaN(rightNumber);
  const left = numeric ? leftNumber : String(actual);
  const right = numeric ? rightNumber : String(expected);
  switch (op) {
    case 'gt':
      return left > right;
    case 'gte':
      return left >= right;
    case 'lt':
      return left < right;
    case 'lte':
      return left <= right;
  }
}

/** Pure condition evaluator; declarative operators plus recursive and/or/not. */
export function evaluateCondition(
  condition: Condition | ConditionFn,
  ctx: ConditionContext,
): boolean {
  if (typeof condition === 'function') {
    return condition({
      form: ctx.form,
      values: ctx.values ?? ctx.form?.getFieldsValue?.(true) ?? {},
    });
  }

  if ('and' in condition) {
    return (condition.and ?? []).every((child) => evaluateCondition(child, ctx));
  }
  if ('or' in condition) {
    return (condition.or ?? []).some((child) => evaluateCondition(child, ctx));
  }
  if ('not' in condition) {
    return !(condition.not && evaluateCondition(condition.not, ctx));
  }

  const { field, op, value } = condition as CompareCondition;
  const actual = get(ctx.values, field);
  switch (op) {
    case 'eq':
      return actual === value;
    case 'ne':
      return actual !== value;
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      return compare(actual, value, op);
    case 'in':
      return Array.isArray(value) && value.includes(actual);
    case 'nin':
      return !Array.isArray(value) || !value.includes(actual);
    case 'empty':
      return isEmpty(actual);
    case 'notEmpty':
      return !isEmpty(actual);
    case 'includes':
      return Array.isArray(actual) && actual.includes(value);
    default:
      return false;
  }
}

/** Recursively extract normalized field paths from a declarative condition. */
export function getConditionPaths(condition: Condition): NamePath[] {
  const paths: NamePath[] = [];
  const visit = (node: Condition) => {
    if ('field' in node) {
      paths.push(typeof node.field === 'string' ? toNamePath(node.field) : node.field);
      return;
    }
    if (node.and) node.and.forEach(visit);
    if (node.or) node.or.forEach(visit);
    if (node.not) visit(node.not);
  };
  visit(condition);
  return paths;
}

/** Collect deduplicated watch paths: declarative conditions auto-extract, functions use explicit watch. */
export function collectWatchPaths(fields: FieldSchema[]): NamePath[] {
  const paths: NamePath[] = [];
  for (const field of fields) {
    const condition = field.condition;
    if (!condition) continue;
    if (typeof condition === 'function') {
      paths.push(...(field.watch ?? []));
    } else {
      paths.push(...getConditionPaths(condition));
    }
  }
  return uniqPaths(paths);
}
