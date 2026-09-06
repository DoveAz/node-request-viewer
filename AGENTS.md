# node-request-viewer

## 项目作用

`node-request-viewer` 是一个运行在 Node.js 进程内部的请求监控面板。它通过 `@mswjs/interceptors` 捕获 `fetch`、Node.js `http` 和 `https` 请求，在请求开始时生成 `Pending` 记录，在响应完成或请求失败时更新同一条记录。

项目不使用 HTTPS 中间人代理。监控服务只绑定 `127.0.0.1`，提供类似 Chrome Network、Reqable 的本地 Web 面板，并把记录持久化为 NDJSON，支持进程重启后查看历史请求。

## 实现结构

- `index.ts`：公开 npm API，只导出 `startNetworkMonitor` 及其类型。
- `src/monitor.ts`：启动和关闭监控器，协调拦截器、存储和本地服务。
- `src/interceptor.ts`：适配 `@mswjs/interceptors`，生成统一的请求、响应和错误记录。
- `src/store.ts`：读写 `requests.ndjson`，按请求 ID 合并 Pending 与最终状态。
- `src/server.ts`：提供本地 HTTP 静态资源、历史记录 API 和 WebSocket 推送。
- `src/types.ts`：请求记录和响应体的共享类型。
- `src/public/`：面板页面；浏览器端使用 CDN 版 `highlight.js` 做高亮。
- `example/app.ts`：包含多种请求方法和响应类型的可运行示例。
- `test/monitor.test.ts`：覆盖请求采集、持久化和停止后的生命周期行为。

请求数据流为：拦截器事件 → `store.append()` 写入 NDJSON → `server.publish()` 推送 WebSocket → 面板更新左侧列表和右侧详情。

## 开发约定

- 只使用 pnpm 管理依赖和锁文件。
- Node.js 版本要求为 22 或更高。
- 源码使用 TypeScript、ESM 和 `NodeNext` 模块解析；构建产物输出到 `dist/`。
- `src/public/index.html` 不是 TypeScript 编译产物，构建时由 `scripts/copy-public.mjs` 复制到 `dist/src/public/`。
- 仅导入监控模块不能产生副作用；必须显式调用 `startNetworkMonitor()`。
- `stop()` 必须恢复原始请求实现并释放面板端口。
- 端口冲突和服务启动错误需要直接抛出，不能静默切换端口或吞掉错误。
- 请求和响应 body 默认原样记录；二进制数据以 Base64 保存。

## 常用命令

```bash
pnpm install
pnpm build
pnpm test
pnpm example
```

`pnpm build` 会生成 npm 发布所需的 JavaScript、类型声明和面板静态资源。`package.json` 的 `prepublishOnly` 会在发布前自动执行构建和测试；npm 入口是 `dist/index.js`，类型入口是 `dist/index.d.ts`。
