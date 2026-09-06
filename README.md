# node-request-viewer

一个进程内的 Node.js 请求监控面板，提供类似 Chrome Network、Reqable 的实时查看体验。它使用 `@mswjs/interceptors` 观察 `fetch`、Node.js `http` 和 `https` 请求，不需要 HTTPS 中间人证书。请求在开始时立即以 `Pending` 状态显示，完成后更新为最终状态；详情 body 和 headers 使用浏览器端 CDN 加载的 `highlight.js` 高亮。

## 安装

Node.js 需要 22 或更高版本：

```bash
pnpm add node-request-viewer
```

## 在业务代码中使用

```js
import { startNetworkMonitor } from "node-request-viewer";

const monitor = await startNetworkMonitor({
  port: 4318,
  open: true,
  output: "./.network-logs",
});

await fetch("https://example.com");

process.once("SIGINT", async () => {
  await monitor.stop();
  process.exit(0);
});
```

仅导入 `startNetworkMonitor` 不会启动服务；必须显式调用它。端口被占用或服务启动失败时会直接抛出错误。

`startNetworkMonitor()` 返回一个带有 `stop()` 方法的 monitor。调用 `stop()` 会停止面板、断开 WebSocket，并恢复原始请求实现。`output` 目录中的 `requests.ndjson` 会保存请求记录，面板重新打开时会读取已有记录。

选项：

- `port`：面板端口，默认 `4318`；端口被占用时直接抛错。
- `open`：是否使用系统浏览器打开面板。
- `output`：NDJSON 日志目录。

请求内容默认原样记录。二进制内容会以 Base64 保存，并在面板中标识编码方式；监控器不会替换代理配置，也不会执行 HTTPS 中间人代理。

## 运行示例

仓库中的 [example/app.ts](./example/app.ts) 包含 JSON、表单、HTML、图片、HEAD、OPTIONS、`http.get` 和 `https.get` 等真实请求示例。使用 pnpm 构建并运行：

```bash
pnpm install
pnpm example
```

开发时可以使用同一个命令构建并运行 TypeScript 示例：

```bash
pnpm dev
```

启动后打开终端输出的面板地址即可查看实时请求。

## 开发命令

```bash
pnpm build   # 编译 TypeScript、生成类型声明和面板静态资源
pnpm test    # 运行测试
```

## 发布

发布前会自动执行构建和测试：

```bash
pnpm login --registry=https://registry.npmjs.org
pnpm publish
```

包的仓库地址是 [github.com/DoveAz/node-request-viewer](https://github.com/DoveAz/node-request-viewer)。
