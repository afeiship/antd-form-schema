import { getConditionPaths } from '../core/condition';
import { resolveName, toNamePath } from '../core/utils';
import { BUILTIN_WIDGET_IDS } from '../widgets/widget-ids';
import type {
  FieldSchema,
  FieldConverter,
  FormSchema,
  Issue,
  NamePath,
  WidgetDef,
} from './types';

/** Turn a normalized path back into a readable name for issue messages. */
function pathToName(path: NamePath): string {
  const parts: (string | number)[] = Array.isArray(path) ? path : toNamePath(path);
  if (parts.length === 1 && String(parts[0]).includes('.')) return `!!!${parts[0]}`;
  return parts.join('.');
}

/** Valid valueType values, shared by the validator. */
const VALUE_TYPES = ['dayjs', 'string', 'number', 'timestamp'];

/** Validate a schema and return issues. Dev/prod behavior is decided by the hook. */
export function validateMeta(
  meta: FormSchema,
  widgets?: Record<string, WidgetDef>,
  converters?: Record<string, FieldConverter>,
): Issue[] {
  if (!Array.isArray(meta.fields)) {
    return [{ level: 'error', message: 'fields must be an array' }];
  }

  const fields: FieldSchema[] = meta.fields;
  const seenKeys = new Set<string>();
  const namePaths = new Set(
    fields.filter((field) => field.key).map((field) => JSON.stringify(resolveName(field))),
  );
  const issues: Issue[] = [];

  fields.forEach((field, index) => {
    if (!field.key) {
      issues.push({ level: 'error', message: `field at index ${index} is missing key`, index });
    } else if (seenKeys.has(field.key)) {
      issues.push({
        level: 'error',
        message: `duplicate key "${field.key}" at index ${index}`,
        field: field.key,
        index,
      });
    } else {
      seenKeys.add(field.key);
    }

    if (typeof field.widget === 'string') {
      const registered = widgets && Object.prototype.hasOwnProperty.call(widgets, field.widget);
      if (!registered && !BUILTIN_WIDGET_IDS.includes(field.widget)) {
        issues.push({
          level: 'error',
          message: `unregistered widget "${field.widget}"`,
          field: field.key,
        });
      }
    }

    if (field.options !== undefined && !Array.isArray(field.options)) {
      issues.push({ level: 'error', message: 'options must be an array', field: field.key });
    }

    if (field.valueType !== undefined && !VALUE_TYPES.includes(field.valueType)) {
      issues.push({
        level: 'warning',
        message: `unknown valueType "${field.valueType}"`,
        field: field.key,
      });
    }

    const converterId = field.converter ?? meta.converters?.[field.key];
    if (converterId !== undefined) {
      const registered =
        converters && Object.prototype.hasOwnProperty.call(converters, converterId);
      if (!registered) {
        issues.push({
          level: 'error',
          message: `unregistered converter "${converterId}"`,
          field: field.key,
        });
      }
      if (field.valueType !== undefined) {
        issues.push({
          level: 'error',
          message: `converter "${converterId}" cannot be combined with valueType on field "${field.key}"`,
          field: field.key,
        });
      }
    }

    if (
      field.rules !== undefined &&
      (!Array.isArray(field.rules) ||
        field.rules.some((rule) => rule === null || typeof rule !== 'object'))
    ) {
      issues.push({ level: 'warning', message: 'rules must be an array of objects', field: field.key });
    }

    const condition = field.condition;
    if (condition && typeof condition !== 'function') {
      for (const path of getConditionPaths(condition)) {
        const parts: NamePath = Array.isArray(path) ? path : toNamePath(path);
        if (!namePaths.has(JSON.stringify(parts))) {
          const name = pathToName(parts);
          issues.push({
            level: 'warning',
            message: `condition field "${name}" does not exist`,
            field: name,
          });
        }
      }
    }
  });

  return issues;
}
