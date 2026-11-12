'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
function applicationText(name) {
  return fs.readFileSync(path.join(root, name), 'utf8').split('\n')
    .filter(line => !line.includes('"legacy.exact.') && !line.includes('"legacy.pattern.')
      && !line.includes('class="version-log-item"') && line.length < 12000).join('\n');
}
const main = applicationText('index.html');
const advanced = applicationText('module-tools.html');

test('statistics export failure states both retained settings and absent download', () => {
  assert.ok(main.includes('预览生成失败。导出设置已保留，图片尚未下载。'));
  assert.ok(!main.includes('预览生成失败；当前导出设置未清空'));
});

test('PC gallery feedback reports requested downloads without claiming saved files', () => {
  assert.ok(main.includes('已请求下载 ${count} 张图片。请在下载记录中确认文件是否保存。'));
  assert.ok(main.includes('附件概览读取失败。未删除任何附件。'));
  assert.ok(main.includes('仅对新上传的图片生效。已有图片不变。'));
});

test('plan, record and PC editor prompts contain direct next actions', () => {
  assert.ok(main.includes('本桌尚未关联模组档案。请在计划中选择已有模组'));
  assert.ok(main.includes('当前 PC 关联 ${links.length} 条计划或跑团记录。'));
  assert.ok(main.includes('默认时间用于新安排。每次安排可单独修改。'));
});

test('source checks and drafts distinguish saved data from unfinished edits', () => {
  assert.ok(main.includes('导入失败。当前 PC 草稿已保留，正式档案未修改。'));
  assert.ok(main.includes('导入可能已修改当前 PC 草稿，尚未正式保存。'));
  assert.ok(main.includes('当前结果仅供查看，未修改档案。'));
  assert.ok(main.includes('临时草稿尚未保存'));
});

test('software update feedback avoids long semicolon chaining', () => {
  assert.ok(main.includes('当前有未保存的编辑内容，程序尚未更新。档案数据保持不变。'));
  assert.ok(main.includes('尚未确认更新结果。档案数据没有修改。'));
  assert.ok(main.includes('请保存当前修改，再点击“检查并更新”。'));
});

test('advanced module tool distinguishes requested exports from verified restoration', () => {
  assert.ok(advanced.includes('已请求下载模组完整备份，请在下载记录中确认。'));
  assert.ok(advanced.includes('已请求下载模组 Excel，请在下载记录中确认。'));
  assert.ok(advanced.includes('已请求下载便携 HTML，请在下载记录中确认。'));
  assert.ok(advanced.includes('导入尚未写入，原档案保持不变。'));
  assert.ok(advanced.includes('写入状态无法确认，请暂停操作并核对数据。'));
});

test('safety instructions and schema remain explicit and unchanged', () => {
  assert.ok(main.includes('不要清除网站数据'));
  assert.ok(main.includes('无法安全回读'));
  assert.ok(main.includes('const DATA_SCHEMA_VERSION = 26'));
  assert.ok(advanced.includes('已停止编辑和导入。'));
});
