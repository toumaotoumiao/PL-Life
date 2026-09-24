/* PL收集梦想生活 · 数据版本与启动保护（schema 26）。
   This module only inspects; it never writes or removes stored user data. */
(function (root) {
  'use strict';
  var FORMAT = 'tomato-pl-archive';
  var MIN_SCHEMA = 9;
  var MAX_SCHEMA = 26;
  var KEY = 'trpg_pl_profile_archive_v1';
  var GUARD_KEY = 'tomato_pl_upgrade_guard_v1';
  function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  function hasOwn(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }
  function result(kind, detail) {
    var out = { kind: kind, allowed: kind === 'fresh' || kind === 'canonical' || kind === 'legacy', schema: null, reason: '' };
    if (detail) for (var key in detail) if (hasOwn(detail, key)) out[key] = detail[key];
    return out;
  }
  function inspect(raw) {
    if (raw === null || raw === undefined) return result('fresh');
    if (Array.isArray(raw)) return result('legacy');
    if (!plain(raw)) return result('invalid', { reason: '档案顶层结构无效' });
    if (hasOwn(raw, 'format') || hasOwn(raw, 'schemaVersion') || hasOwn(raw, 'data')) {
      if (raw.format !== FORMAT) return result('unsupported', { reason: '档案格式标记无法识别' });
      var n = raw.schemaVersion;
      if (typeof n !== 'number' || !Number.isInteger(n)) return result('invalid-schema', { reason: '数据结构版本无效' });
      if (n > MAX_SCHEMA) return result('future', { schema: n, reason: '此档案由更新的数据结构生成' });
      if (n < MIN_SCHEMA) return result('unsupported-schema', { schema: n, reason: '数据结构版本尚未验证' });
      if (!plain(raw.data) || !Array.isArray(raw.data.profiles) || !Array.isArray(raw.data.modules) || !Array.isArray(raw.data.runs) || (n >= 23 && !Array.isArray(raw.data.pcs))) {
        return result('invalid', { schema: n, reason: '标准档案缺少必要集合' });
      }
      return result('canonical', { schema: n, legacySchema: n < MAX_SCHEMA });
    }
    if (Array.isArray(raw.profiles)) return result('legacy');
    return result('unsupported', { reason: '未识别的历史档案格式' });
  }
  function inspectText(text) {
    if (text === null || text === undefined) return result('fresh');
    if (typeof text !== 'string' || !text.trim()) return result('corrupt', { reason: '档案内容为空或无法读取' });
    try { return inspect(JSON.parse(text)); }
    catch (_) { return result('corrupt', { reason: '档案 JSON 无法解析' }); }
  }
  function inspectStartup(storage, embeddedText) {
    var text;
    try {
      if (!root.PLDataMigrationTransaction) return result('transaction-unavailable', {reason:'完整恢复保护模块未加载',source:'program'});
      if (root.PLDataMigrationTransaction.getMarker(storage)) return result('transaction-pending', {reason:'检测到上次完整备份恢复中断，正在核对原始档案和附件',source:'transaction',rawAvailable:true});
    } catch (e) {return result('transaction-invalid', {reason:String(e.message||e),source:'transaction',rawAvailable:true});}
    try { text = storage.getItem(KEY); }
    catch (_) { return result('storage-unavailable', { reason: '浏览器档案存储无法读取', source: 'localStorage' }); }
    var main = inspectText(text);
    if (!main.allowed) return result(main.kind, { schema: main.schema, reason: main.reason, source: 'main', rawAvailable: text !== null });
    // A portable HTML is also a user-supplied archive; do not ignore a future/corrupt embedded backup.
    if (embeddedText !== null && embeddedText !== undefined) {
      var embedded = inspectText(embeddedText);
      if (!embedded.allowed) return result(embedded.kind, { schema: embedded.schema, reason: embedded.reason, source: 'embedded', rawAvailable: true });
    }
    return result('ready', { allowed: true, schema: main.schema, source: text !== null ? 'main' : 'fresh' });
  }
  function requireReadable(raw) {
    var verdict = inspect(raw);
    if (!verdict.allowed || verdict.kind === 'fresh') {
      var e = new Error('已停止处理档案：' + (verdict.reason || '档案格式无法识别') + (verdict.schema !== null ? '（结构 v' + verdict.schema + '）' : ''));
      e.code = 'PL_MIGRATION_PROTECTED';
      throw e;
    }
    return verdict;
  }
  // A recovery guard is a separate source: refuse a newer/invalid guard instead of reinterpreting it as legacy.
  function requireGuardReadable(raw) { return requireReadable(raw); }
  root.PLDataMigrationGuard = Object.freeze({ FORMAT: FORMAT, MIN_SCHEMA: MIN_SCHEMA, MAX_SCHEMA: MAX_SCHEMA, STORAGE_KEY: KEY, GUARD_KEY: GUARD_KEY, inspect: inspect, inspectText: inspectText, inspectStartup: inspectStartup, requireReadable: requireReadable, requireGuardReadable: requireGuardReadable });
})(typeof window !== 'undefined' ? window : globalThis);
