'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
// The historical release log, imported Excel template data and translation archive
// are not editable application copy.
const active = html.split('\n').filter(line =>
  !line.includes('"legacy.exact.') &&
  !line.includes('"legacy.pattern.') &&
  !line.includes('version-log-item') &&
  !line.includes('PC_EXCEL_VERIFIED_BLANK_VARIANTS=')
).join('\n');

test('PC empty state explains two immediate actions in both render paths', () => {
  const short = '点击下方按钮新建 PC，或将 CoC 七版 Excel 角色卡拖入此处导入。';
  assert.equal((active.match(new RegExp(short.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 2);
  assert.doesNotMatch(active, /保存计划不会根据搜索文字自动建档/);
  assert.doesNotMatch(active, /可以手动新建 PC；开团计划中需明确选择/);
  assert.match(active, /data-pc-empty-new/);
});

test('daily settings and onboarding describe actions without long compound notes', () => {
  for (const expected of [
    '外观、评分和显示设置需点击“保存修改”',
    '选择主题可预览效果',
    '档案保存在当前浏览器。请定期导出备份。',
    '修改会自动保存。恢复点可用于撤销误操作。',
    '当前浏览器使用的空间，不含已下载文件。',
    '点击下方按钮新建 PC',
  ]) assert.ok(active.includes(expected), `missing edited UI copy: ${expected}`);
  assert.doesNotMatch(active, /选择主题后立即预览；点击“保存设置”后生效/);
  assert.doesNotMatch(active, /综合评分按字段分数与权重计算。评分样本范围/);
});

test('forbidden artificial contrast grammar is absent from program-authored copy', () => {
  assert.doesNotMatch(active, /不是.{0,40}而是|是.{0,40}不是/);
});

test('data loss and privacy warnings remain available', () => {
  assert.match(active, /清理浏览器数据或更换设备可能导致档案丢失/);
  assert.match(active, /清除浏览器网站数据也会删除恢复点/);
  assert.match(active, /分享前请检查个人信息|分享前请检查文件内容/);
  assert.match(active, /永久清空本设备资料库/);
  assert.match(active, /请先选择并核验完整备份 ZIP/);
});

test('all main navigation and data export actions remain present', () => {
  for (const page of ['PL 档案', 'PC 档案', '模组档案', '开团计划', '跑团记录', '个人偏好', '个人统计'])
    assert.ok(active.includes(page), `missing navigation: ${page}`);
  for (const id of ['newPcBtn', 'pcBatchExcelInput', 'moduleNativeSearch', 'planSearchInput', 'recordsSearchInput', 'exportBtn', 'restoreFromBackupBtn'])
    assert.match(active, new RegExp(`id="${id}"`));
});
