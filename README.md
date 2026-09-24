# PL-Life
PL收集梦想生活正式站

正式站地址：https://toumaotoumiao.github.io/PL-Life/

## 正式站与测试站隔离

`/PL-Life/` 与 `/PL-Life-Test/` 同属 `toumaotoumiao.github.io` 这一浏览器 origin。自 v8.1.12.161 起，两站通过 pathname-scoped localStorage / sessionStorage、IndexedDB、Cache Storage、运行期下载缓存与 BroadcastChannel 命名空间保持隔离。

正式站继续使用生产命名空间；测试站使用 `pl-life-test::` / `pl-life-test__` / `pl-life-test-*` 等独立命名。维护时不得让测试站写回正式站旧共享主档案 key，也不得让任一站的 Service Worker 清理另一站缓存。

`.github/pl-ci` 与 `.github/workflows` 属于正式发布维护资产：每次版本升级需与运行文件同步更新，用于守护当前发布契约、静态回归和 GitHub Chromium 浏览器检查。测试夹具只能使用固定虚构数据，不得提交用户备份、真实人物信息、原始角色卡或含个人信息的截图。
