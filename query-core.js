/* PL收集梦想生活 · 查询内核 v0.2.0（PC 页已接入，其余页面仍在适配）。
 * 零外部依赖；零 DOM / 存储 / 网络访问。
 * 在 Node 可通过 require() 使用，在浏览器显式引入后暴露 globalThis.PLQueryCore。
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else if (root) root.PLQueryCore = api;
})(typeof globalThis === 'object' ? globalThis : null, function () {
  'use strict';
  const collator = new Intl.Collator('zh-Hans-CN', {numeric: true, sensitivity: 'base'});
  const isMissing = value => value === null || value === undefined || (typeof value === 'string' && !value.trim());
  const normalize = value => String(value == null ? '' : value).normalize('NFKC').trim().toLocaleLowerCase();
  function flatten(value) {
    if (Array.isArray(value)) return value.flatMap(flatten);
    if (value === null || value === undefined) return [];
    return [String(value)];
  }
  function textValues(value) { return flatten(value).map(normalize).filter(Boolean); }
  function tokenized(input) { return normalize(input).split(/\s+/u).filter(Boolean).slice(0, 16); }
  function accessor(schema, field) {
    if (!Object.prototype.hasOwnProperty.call(schema.fields, field)) throw new Error('未知筛选字段：' + field);
    const spec = schema.fields[field];
    if (!spec || typeof spec.get !== 'function') throw new TypeError('字段缺少读取函数：' + field);
    return spec;
  }
  function numeric(value) {
    if (isMissing(value) || typeof value === 'boolean') return null;
    const result = typeof value === 'number' ? value : Number(String(value).trim());
    return Number.isFinite(result) ? result : null;
  }
  function scalarEquals(a, b) {
    if (typeof a === 'number' && typeof b === 'number') {
      const x = numeric(a), y = numeric(b);
      if (x !== null && y !== null) return x === y;
    }
    return normalize(a) === normalize(b);
  }
  // 区间交集：用于模组人数/时长，闭区间；Infinity 仅可作为开放上限。
  function interval(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const min = numeric(value.min), max = value.max === Infinity ? Infinity : numeric(value.max);
    return min === null || max === null || min > max ? null : {min, max};
  }
  function filterMatches(raw, clause) {
    if (!clause || typeof clause !== 'object') throw new TypeError('筛选条件应为对象');
    const {op} = clause;
    if (op === 'overlap') {
      const low = clause.min === '' || clause.min == null ? -Infinity : numeric(clause.min);
      const high = clause.max === '' || clause.max == null ? Infinity : numeric(clause.max);
      if (low === null || high === null || low > high) return false;
      return (Array.isArray(raw) ? raw : [raw]).some(v => {
        const r = interval(v);return Boolean(r && r.max >= low && high >= r.min);
      });
    }
    if (op === 'exists') {
      const values = Array.isArray(raw) ? raw : [raw];
      const present = values.some(v => !isMissing(v));
      return present === (clause.value !== false);
    }
    if (op === 'in' || op === 'notIn') {
      if (!Array.isArray(clause.values)) throw new TypeError('多选条件缺少 values 数组');
      const selected = clause.values;
      if (!selected.length) return true;
      const values = Array.isArray(raw) ? raw : [raw];
      const matches = values.some(v => selected.some(s => scalarEquals(v, s)));
      return op === 'in' ? matches : !matches;
    }
    if (op === 'eq') return !isMissing(clause.value) && (Array.isArray(raw) ? raw : [raw]).some(v => !isMissing(v) && scalarEquals(v, clause.value));
    if (op === 'contains') return !isMissing(clause.value) && textValues(raw).some(v => v.includes(normalize(clause.value)));
    if (op === 'range' || op === 'dateRange') {
      if (clause.min != null && clause.max != null && String(clause.min) > String(clause.max) && op === 'dateRange') return false;
      const lower = clause.min === '' || clause.min == null ? null : (op === 'range' ? numeric(clause.min) : String(clause.min));
      const upper = clause.max === '' || clause.max == null ? null : (op === 'range' ? numeric(clause.max) : String(clause.max));
      if (op === 'range' && ((clause.min != null && clause.min !== '' && lower === null) || (clause.max != null && clause.max !== '' && upper === null))) return false;
      if (lower !== null && upper !== null && lower > upper) return false;
      const values = Array.isArray(raw) ? raw : [raw];
      return values.some(v => {
        const x = op === 'range' ? numeric(v) : (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
        if (x === null || isMissing(v)) return false;
        return (lower === null || x >= lower) && (upper === null || x <= upper);
      });
    }
    throw new Error('未知筛选操作：' + String(op));
  }
  function scoreMatch(row, searchFields, tokens) {
    if (!tokens.length) return 0;
    let total = 0;
    for (const token of tokens) {
      let best = Infinity;
      for (const spec of searchFields) {
        const values = textValues(spec.get(row));
        const weight = Number.isFinite(spec.weight) ? spec.weight : 10;
        for (const value of values) {
          const quality = value === token ? 0 : value.startsWith(token) ? 1 : value.includes(token) ? 2 : Infinity;
          best = Math.min(best, weight * 10 + quality);
        }
      }
      if (!Number.isFinite(best)) return Infinity;
      total += best;
    }
    return total;
  }
  function sortable(value, type) {
    if (isMissing(value)) return null;
    if (type === 'number') return numeric(value);
    if (type === 'date') {
      if (typeof value === 'number') return Number.isFinite(value) ? value : null;
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return Date.parse(value + 'T00:00:00Z');
      const n = Date.parse(value);
      return Number.isFinite(n) ? n : null;
    }
    return String(value);
  }
  function compareSort(a, b, type) {
    if (type === 'number' || type === 'date' && typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : 0;
    return collator.compare(String(a), String(b));
  }
  function validate(schema, query) {
    if (!schema || !schema.fields || !Array.isArray(schema.search)) throw new TypeError('查询 schema 缺少 fields 或 search');
    if (!schema.id || typeof schema.id !== 'function') throw new TypeError('查询 schema 缺少 ID 读取函数');
    if (!query || typeof query !== 'object' || Array.isArray(query)) throw new TypeError('查询条件无效');
    const filters = query.filters || {};
    if (filters === null || typeof filters !== 'object' || Array.isArray(filters)) throw new TypeError('筛选条件无效');
    for (const key of Object.keys(filters)) accessor(schema, key);
    if (query.sort && query.sort.field !== 'relevance') accessor(schema, query.sort.field);
    if (query.sort && !['asc','desc'].includes(query.sort.direction || 'asc')) throw new Error('排序方向无效');
    return filters;
  }
  /* sourceScope 在任何搜索和分面统计之前应用：隐私或数据范围由调用者提供。 */
  function execute({rows, schema, query = {}, sourceScope, facets = {}}) {
    if (!Array.isArray(rows)) throw new TypeError('rows 应为数组');
    const filters = validate(schema, query);
    const tokens = tokenized(query.search || '');
    const scope = typeof sourceScope === 'function' ? sourceScope : () => true;
    const visible = rows.filter(scope);
    const searchFields = schema.search;
    const searchRanked = [];
    for (const row of visible) {
      const rank = scoreMatch(row, searchFields, tokens);
      if (Number.isFinite(rank)) searchRanked.push({row, rank});
    }
    function passes(item, omitField) {
      for (const [key, clause] of Object.entries(filters)) {
        if (key !== omitField && !filterMatches(accessor(schema, key).get(item.row), clause)) return false;
      }
      return true;
    }
    const filtered = searchRanked.filter(item => passes(item));
    const sort = query.sort || {field: 'relevance'};
    const sortField = sort.field || 'relevance';
    const direction = sort.direction === 'desc' ? -1 : 1;
    const spec = sortField === 'relevance' ? null : accessor(schema, sortField);
    filtered.sort((a, b) => {
      if (spec) {
        const av = sortable((spec.sort || spec.get)(a.row), spec.type || 'text');
        const bv = sortable((spec.sort || spec.get)(b.row), spec.type || 'text');
        if (av === null && bv !== null) return 1;
        if (bv === null && av !== null) return -1;
        if (av !== null && bv !== null) {
          const delta = compareSort(av, bv, spec.type) * direction;
          if (delta) return delta;
        }
      }
      if (tokens.length && a.rank !== b.rank) return a.rank - b.rank;
      return collator.compare(String(schema.id(a.row)), String(schema.id(b.row)));
    });
    const counts = {};
    for (const [key, options] of Object.entries(facets)) {
      const get = accessor(schema, key).get;
      if (!Array.isArray(options)) throw new TypeError('分面选项应为数组');
      const candidates = searchRanked.filter(item => passes(item, key));
      counts[key] = options.map(value => ({value, count: candidates.filter(({row}) => filterMatches(get(row), {op:'in',values:[value]})).length}));
    }
    return {rows: filtered.map(x => x.row), ids: filtered.map(x => String(schema.id(x.row))), count: filtered.length, searchedCount: searchRanked.length, total: visible.length, facets:counts};
  }
  function updateQuery(query, action) {
    if (!action || typeof action !== 'object') throw new TypeError('查询操作无效');
    const next = {...query, filters: {...(query.filters || {})}};
    if (['filter','clear-filter'].includes(action.type) && (typeof action.field !== 'string' || !/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(action.field))) throw new Error('筛选字段标识无效');
    switch (action.type) {
      case 'search': next.search = String(action.value || ''); break;
      case 'filter': next.filters[action.field] = action.clause; break;
      case 'clear-filter': delete next.filters[action.field]; break;
      case 'clear-filters': next.filters = {}; break;
      case 'reset-query': return {search:'', filters:{}, sort:query.sort || {field:'relevance'}};
      case 'sort': next.sort = {...action.sort}; break;
      default: throw new Error('未知查询操作：' + action.type);
    }
    return next;
  }
  return Object.freeze({execute, updateQuery, normalize, isMissing, filterMatches, version:'0.2.0'});
});
