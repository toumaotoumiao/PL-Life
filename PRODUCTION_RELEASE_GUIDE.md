# PL收集梦想生活 · 正式发布同步说明

## 当前状态的唯一来源

发布、验收和继续开发前，先读取根目录 `CURRENT_PROJECT_STATUS.json`。该文件是当前版本、阶段、真实设备验收和未闭环事项的唯一状态源。

`STAGE*.md` 只保留为历史时间点快照，不回写、不覆盖，也不得用旧 Stage 报告替代当前状态判断。


当前正式发布候选的版本号与 schema 以 `CURRENT_PROJECT_STATUS.json` 的 `current` 字段为准。

## 使用范围
- 使用 `CURRENT_PROJECT_STATUS.json` 的 `currentVersionAcceptance.release.artifactNames` 中列出的“正式仓库完整同步包”，只用于正式仓库 `PL-Life`。
- 不要把测试仓库、历史内部报告、真实备份、角色 Excel 或验收 artifact 上传到正式仓库。
- 正式站与测试站继续依赖 `runtime-environment.js` 按路径隔离存储。

## 发布前
1. 测试站当前提交的 Synthetic 与 Native ZIP restore gate 必须通过。
2. 手机规则菜单针对性确认通过：面板位于触发按钮下方，同按钮、点击外部和 Esc 均可关闭。
3. 使用 `python .github/pl-ci/build-production-release.py --check-only` 运行正式发布预检。

## 覆盖方式
将正式仓库同步包解压后覆盖 `PL-Life` 本地仓库。正式仓库不需要历史 Stage 内部报告。

## 发布后只检查
- 页面显示版本与 `CURRENT_PROJECT_STATUS.json` 的 `current.appVersion` 一致；
- Service Worker 缓存版本与该版本一致；
- PL/PC/模组/计划/记录可正常打开；
- 原有正式数据仍存在。

不要在正式站重新做破坏性恢复演练；完整恢复链已经由测试站的隔离原生 CI 验收。
