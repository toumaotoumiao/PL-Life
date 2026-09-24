# PL-Life-Test
PL收集梦想生活测试站

## 测试站与正式站隔离

`/PL-Life/` 与 `/PL-Life-Test/` 同属 `toumaotoumiao.github.io` 这一浏览器 origin，不能仅靠路径区分 localStorage、IndexedDB、Cache Storage 或 BroadcastChannel。

从 v8.1.12.161 起，测试站必须使用独立运行命名空间：

- localStorage / sessionStorage: `pl-life-test::...`
- IndexedDB: `pl-life-test__...`
- program cache: `pl-life-test-*`
- runtime download cache: `pl-life-test-runtime-downloads-v1`
- BroadcastChannel: `pl-life-test::...`

首次升级只复制旧共享数据到测试命名空间，不删除、覆盖旧正式站存储。外部自动备份文件夹授权不继承到测试站。

维护时不得把测试站缓存前缀改回 `pl-life-prod-*`，也不得让测试站保存重新写入旧共享主档案 key。
