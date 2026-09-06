import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, type WebSocket } from "ws";
import type { RequestStore } from "./store.js";

const publicDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "public");

export interface ServerInterface {
  url: string;
  publish(record: unknown): void;
  close(): Promise<void>;
}

export async function createServerInterface({ port, store }: { port: number; store: RequestStore }): Promise<ServerInterface> {
  const clients = new Set<WebSocket>();
  const server = createServer(async (request, response) => {
    if (request.url === "/api/requests") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(await store.readAll()));
      return;
    }
    const path = request.url === "/" ? "/index.html" : (request.url ?? "/index.html").split("?", 1)[0];
    const file = resolve(publicDirectory, `.${path}`);
    if (!file.startsWith(publicDirectory)) {
      response.writeHead(404).end();
      return;
    }
    try {
      const content = await readFile(file);
      const contentType = file.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8";
      response.writeHead(200, { "content-type": contentType });
      response.end(content);
    } catch (error) {
      const code = error instanceof Error && "code" in error ? error.code : undefined;
      response.writeHead(code === "ENOENT" ? 404 : 500).end(error instanceof Error ? error.message : String(error));
    }
  });
  const webSocketServer = new WebSocketServer({ server });
  webSocketServer.on("connection", (socket) => {
    clients.add(socket);
    socket.on("close", () => clients.delete(socket));
  });
  await new Promise<void>((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Network monitor server did not expose a TCP address");
  return {
    url: `http://127.0.0.1:${address.port}`,
    publish(record: unknown) {
      const message = JSON.stringify(record);
      for (const client of clients) if (client.readyState === 1) client.send(message);
    },
    close() {
      webSocketServer.close();
      return new Promise<void>((resolvePromise, reject) => server.close((error) => error ? reject(error) : resolvePromise()));
    },
  };
}
