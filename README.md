# PL收集梦想生活

当前产品版本：v8.1.12.300 / schema26。

`CURRENT_PROJECT_STATUS.json` 是唯一的当前项目状态源；历史 `STAGE*.md` 仅表示当时的时间点快照。

Stage122 针对真实用户错误报告中的“PC 附件数据库 v0 → v3 在 upgradeneeded 中止”修复全新设备建库：在浏览器可枚举现有 IndexedDB 版本时，PC 附件库按 v1 → v2 → v3 逐步建立，恢复点库按 v1 → v2 建立；每一步记录具体仓库、已完成步骤与版本变更事务异常。新增 Round292 全新浏览器 v0 建库 Chromium 发布门。schema26 与完整 ZIP 格式不变。

Stage118 修复 Round242 合成 Chromium 在桌面→320px 切换时的媒体查询竞态假红；测试现在等待生产响应式监听稳定后再展开并检查 PC 导出菜单。产品 D&D 导出逻辑与数据没有因此改变。

Stage117 为完整备份恢复增加隐私友好的本机故障定位：ZIP 校验后会在“恢复并替换”确认之前预检 PC 附件数据库和恢复点数据库；恢复失败会标明具体阶段，并只报告 IndexedDB 版本、对象仓库名称等匿名结构信息，不读取或输出 PL／PC 名称、Log、图片、Excel 内容或备份正文。遇到他人私人备份故障时，不需要索要 ZIP，即可先区分浏览器数据库升级问题与备份内容问题。

Stage115 的开团计划单次安排时间快速编辑继续保留；Stage114 的 Round141 合成 Chromium 修复与 Stage113 的计划默认具体时间继续作为当前基线。schema26 与完整 ZIP 格式不变。

图片导出代码与自动化主线已在 Stage99 收口；D&D 模板与真实设备相关项目继续以 `CURRENT_PROJECT_STATUS.json` 中的当前待验收项为准。


Stage117 增加独立 storage-diagnostic.html：只读取 IndexedDB 数据库版本、对象仓库与索引结构，不读取记录内容，不触发数据库升级、删除或写入；换设备迁移的 ZIP 只读核验与恢复入口进一步隔离。
