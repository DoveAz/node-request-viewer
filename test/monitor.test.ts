import { describe, expect, it } from "vitest";
import http from "node:http";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startNetworkMonitor } from "../src/monitor.js";

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function getHttp(url) {
  return new Promise((resolve, reject) => {
    const request = http.request(url, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    request.on("error", reject);
    request.end();
  });
}

describe("network monitor", () => {
  it("captures fetch and persists complete records", async () => {
    const target = http.createServer((request, response) => {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ method: request.method, path: request.url }));
    });
    const targetPort = await listen(target);
    const output = await mkdtemp(join(tmpdir(), "network-monitor-"));
    const monitor = await startNetworkMonitor({ port: 0, open: false, output });

    const response = await fetch(`http://127.0.0.1:${targetPort}/fetch`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ method: "GET", path: "/fetch" });
    await new Promise((resolve) => setTimeout(resolve, 20));

    await monitor.stop();
    target.close();
    const lines = (await readFile(join(output, "requests.ndjson"), "utf8")).trim().split("\n");
    const record = JSON.parse(lines.at(-1));
    expect(record.method).toBe("GET");
    expect(record.url).toContain("/fetch");
    expect(record.status).toBe(200);
    expect(record.responseBody.type).toBe("json");
    expect(record.responseBody.mimeType).toBe("application/json");
    expect(record.responseBody.value).toContain('"path":"/fetch"');
  });

  it("captures direct http requests and restores them after stop", async () => {
    const target = http.createServer((request, response) => response.end("ok"));
    const targetPort = await listen(target);
    const output = await mkdtemp(join(tmpdir(), "network-monitor-"));
    const monitor = await startNetworkMonitor({ port: 0, open: false, output });

    await getHttp(`http://127.0.0.1:${targetPort}/http`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await monitor.stop();
    await getHttp(`http://127.0.0.1:${targetPort}/after-stop`);
    target.close();

    const records = (await readFile(join(output, "requests.ndjson"), "utf8")).trim().split("\n").map(JSON.parse);
    expect(records).toHaveLength(2);
    expect(records[0].state).toBe("pending");
    expect(records[1].state).toBe("complete");
    expect(records[1].url).toContain("/http");
  });
});
