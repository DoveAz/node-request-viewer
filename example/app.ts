import http from "node:http";
import https from "node:https";
import { startNetworkMonitor } from "../src/monitor.js";

const monitor = await startNetworkMonitor({
  port: 4318,
  open: true,
  output: "./.network-logs",
});

async function showFetch(label: string, url: string, options?: RequestInit): Promise<void> {
  const response = await fetch(url, options);
  const body = await response.arrayBuffer();
  console.log(label, response.status, `${body.byteLength} bytes`);
}

console.log("Running node-request-viewer examples…");

await showFetch("fetch GET /get", "https://httpbin.org/get");
await showFetch("fetch POST JSON /post", "https://httpbin.org/post", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ source: "node-request-viewer", kind: "json" }),
});
await showFetch("fetch PUT form /put", "https://httpbin.org/put", {
  method: "PUT",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ source: "node-request-viewer", kind: "form" }),
});
await showFetch("fetch PATCH /patch", "https://httpbin.org/patch", {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ changed: true }),
});
await showFetch("fetch DELETE /delete", "https://httpbin.org/delete", { method: "DELETE" });
await showFetch("fetch HEAD /get", "https://httpbin.org/get", { method: "HEAD" });
await showFetch("fetch OPTIONS /anything", "https://httpbin.org/anything", { method: "OPTIONS" });
await showFetch("fetch HTML /html", "https://httpbin.org/html");
await showFetch("fetch binary /image/png", "https://httpbin.org/image/png");

function showHttp(label: string, request: Pick<typeof http, "get">, url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    request.get(url, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => {
        console.log(label, response.statusCode, `${Buffer.concat(chunks).byteLength} bytes`);
        resolve();
      });
    }).on("error", reject);
  });
}

await showHttp("http.get", http, "http://httpbin.org/get");
await showHttp("https.get", https, "https://httpbin.org/response-headers?content-type=application%2Fjson");

console.log("Request examples completed. Open the monitor at", monitor.url);

process.once("SIGINT", async () => {
  await monitor.stop();
  process.exit(0);
});
