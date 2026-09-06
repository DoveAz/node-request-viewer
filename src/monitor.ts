import { execFile } from "node:child_process";
import { createInterceptor } from "./interceptor.js";
import { createServerInterface } from "./server.js";
import { createStore } from "./store.js";

export interface NetworkMonitorOptions {
  port?: number;
  open?: boolean;
  output?: string;
}

export interface NetworkMonitor {
  url: string;
  stop(): Promise<void>;
}

function openBrowser(url: string): void {
  const command = process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  execFile(command, args, (error) => {
    if (error) console.error(`Unable to open browser: ${error.message}`);
  });
}

export async function startNetworkMonitor({ port = 4318, open = false, output = "./.network-logs" }: NetworkMonitorOptions = {}): Promise<NetworkMonitor> {
  const store = await createStore(output);
  const server = await createServerInterface({ port, store });
  const interceptor = createInterceptor(async (record, type) => {
    await store.append(record);
    server.publish({ type, record });
  });
  interceptor.apply();
  if (open) openBrowser(server.url);
  console.log(`Network monitor: ${server.url}`);
  let stopped = false;
  return {
    url: server.url,
    async stop() {
      if (stopped) return;
      stopped = true;
      interceptor.dispose();
      await server.close();
    },
  };
}
