# 第 82 轮：Log 备注与保存结果保护

测试数据均为本地合成的模组和桌次，未读取或写入用户备份。

- `round82-log-save-root-cause.test.cjs`：旧版只有 `logLabels` 且缺少配对 `logUrls` 时保留备注；超过数量/相同 URL 冲突时仍阻止丢弃；主档案保存成功后诊断键写满或 UI 刷新失败仍返回成功；主档案本身写入失败仍返回失败。
- `round82-log-live-browser.cjs`：GitHub Actions 的 Chromium 中，实际打开完整测试网页，在开团计划和跑团记录分别向输入框键入独立 Log 备注，触发各自自动保存，回读 localStorage，刷新网页，再核对两条备注和空网址。

旧代码的静态 / VM Log 用例未覆盖浏览器真实输入、主档案后续辅助存储失败、旧格式 `logLabels` 比 `logUrls` 长等情况；因此此前测试通过无法作为现场故障已消失的依据。GitHub 云端浏览器测试通过前不得宣称本次端到端验收通过。
