import { BatchInterceptor } from "@mswjs/interceptors";
import { HttpRequestInterceptor } from "@mswjs/interceptors/http";
import { randomUUID } from "node:crypto";
import type { BodyRecord, RecordEventType, RequestRecord } from "./types.js";

function headersToObject(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries());
}

function contentTypeOf(headers: Headers): string {
  return headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() || "";
}

function bodyType(contentType: string): string {
  if (!contentType) return "text";
  if (contentType.includes("json")) return "json";
  if (contentType.includes("html")) return "html";
  if (contentType.includes("xml")) return "xml";
  if (contentType.includes("javascript") || contentType.includes("ecmascript")) return "javascript";
  if (contentType.includes("css")) return "css";
  if (contentType.includes("graphql")) return "graphql";
  if (contentType.includes("x-www-form-urlencoded") || contentType.includes("multipart/form-data")) return "form";
  if (contentType.startsWith("text/")) return "text";
  if (/^(image|audio|video|font)\//.test(contentType) || contentType.includes("octet-stream")) return "binary";
  return "text";
}

async function readBody(message: Request | Response, headers: Headers): Promise<BodyRecord | null> {
  if (!message.body) return null;
  const bytes = new Uint8Array(await message.clone().arrayBuffer());
  const isText = !bytes.some((byte) => byte === 0);
  const contentType = contentTypeOf(headers);
  return {
    encoding: isText ? "utf8" : "base64",
    type: bodyType(contentType),
    mimeType: contentType || "application/octet-stream",
    size: bytes.byteLength,
    value: isText ? new TextDecoder().decode(bytes) : Buffer.from(bytes).toString("base64"),
  };
}

function errorRecord(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack };
  return { name: "Error", message: String(error) };
}

export function createInterceptor(onRecord: (record: RequestRecord, type: RecordEventType) => Promise<void>) {
  const interceptor = new BatchInterceptor({
    name: "node-network-monitor",
    interceptors: [new HttpRequestInterceptor()],
  });
  const pending = new Map<string, { record: RequestRecord; startedAt: number }>();

  interceptor.on("request", async ({ request, requestId, controller }) => {
    const startedAt = Date.now();
    const record: RequestRecord = {
      id: randomUUID(),
      requestId,
      timestamp: new Date(startedAt).toISOString(),
      method: request.method,
      url: request.url,
      requestHeaders: headersToObject(request.headers),
      requestContentType: contentTypeOf(request.headers),
      requestBody: null,
      status: null,
      statusText: "Pending",
      responseHeaders: null,
      responseBody: null,
      durationMs: null,
      error: null,
      state: "pending",
    };
    pending.set(requestId, { record, startedAt });
    const passthrough = controller.passthrough();
    await onRecord(record, "start");
    record.requestBody = await readBody(request, request.headers);
    await passthrough;
  });

  interceptor.on("response", async ({ requestId, response }) => {
    const entry = pending.get(requestId);
    if (!entry) return;
    entry.record.status = response.status;
    entry.record.statusText = response.statusText;
    entry.record.responseHeaders = headersToObject(response.headers);
    entry.record.responseContentType = contentTypeOf(response.headers);
    entry.record.responseBody = await readBody(response, response.headers);
    entry.record.durationMs = Date.now() - entry.startedAt;
    entry.record.state = "complete";
    pending.delete(requestId);
    await onRecord(entry.record, "update");
  });

  interceptor.on("unhandledException", async ({ requestId, error }) => {
    const entry = pending.get(requestId);
    if (!entry) return;
    entry.record.durationMs = Date.now() - entry.startedAt;
    entry.record.error = errorRecord(error);
    entry.record.state = "error";
    pending.delete(requestId);
    await onRecord(entry.record, "update");
  });

  return {
    apply: () => interceptor.apply(),
    dispose: () => interceptor.dispose(),
  };
}
