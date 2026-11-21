import { describe, expect, it } from 'vitest';
import { applyPresets } from '../src/core/presets';
import type { FormSchema, Presets } from '../src/core/types';

const meta: FormSchema = {
  fields: [{ key: 'title' }, { key: 'status' }, { key: 'user.email' }],
};

describe('applyPresets', () => {
  it('fills widget and label from a sectioned preset file', () => {
    const presets: Presets = {
      fields: { title: 'input', status: { widget: 'select' } },
      labels: { 'zh-CN': { title: '标题', status: '状态' } },
    };
    const merged = applyPresets(meta, presets);
    expect(merged.fields[0]).toMatchObject({ key: 'title', widget: 'input', label: '标题' });
    expect(merged.fields[1]).toMatchObject({ key: 'status', widget: 'select', label: '状态' });
  });

  it('keeps explicit schema widget and label over presets', () => {
    const merged = applyPresets(
      { fields: [{ key: 'title', widget: 'textarea', label: '文章标题' }] },
      { fields: { title: 'input' }, labels: { 'zh-CN': { title: '标题' } } },
    );
    expect(merged.fields[0].widget).toBe('textarea');
    expect(merged.fields[0].label).toBe('文章标题');
  });

  it('picks the requested locale and falls back to zh-CN per key', () => {
    const merged = applyPresets(meta, {
      labels: {
        'zh-CN': { title: '标题', status: '状态' },
        'en-US': { title: 'Title' },
      },
    }, 'en-US');
    expect(merged.fields[0].label).toBe('Title');
    expect(merged.fields[1].label).toBe('状态');
  });

  it('treats a flat table as zh-CN labels and keeps en-US silent', () => {
    const merged = applyPresets({ fields: [{ key: 'title' }] }, { title: '标题' }, 'en-US');
    expect(merged.fields[0].label).toBe('标题');
  });

  it('prefers the full key over its last segment', () => {
    const merged = applyPresets(
      { fields: [{ key: 'user.email' }] },
      { labels: { 'zh-CN': { email: '邮箱', 'user.email': '邮箱地址' } } },
    );
    expect(merged.fields[0].label).toBe('邮箱地址');
  });

  it('falls back to the key itself when no dictionary matches', () => {
    const merged = applyPresets({ fields: [{ key: 'unknownKey' }] }, {});
    expect(merged.fields[0].label).toBe('unknownKey');
  });

  it('uses the builtin dictionary for common keys', () => {
    const merged = applyPresets({ fields: [{ key: 'nickname' }] }, {});
    expect(merged.fields[0].label).toBe('昵称');
  });

  it('returns the same meta when presets are absent', () => {
    expect(applyPresets(meta, undefined)).toBe(meta);
  });

  it('ignores preset keys absent from the schema', () => {
    const merged = applyPresets({ fields: [{ key: 'title' }] }, { fields: { ghost: 'select' } });
    expect(merged.fields).toHaveLength(1);
    expect(merged.fields[0].widget).toBeUndefined();
  });
});
