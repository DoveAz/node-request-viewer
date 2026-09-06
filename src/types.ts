export type BodyEncoding = "utf8" | "base64";

export interface BodyRecord {
  encoding: BodyEncoding;
  type: string;
  mimeType: string;
  size: number;
  value: string;
}

export interface NetworkError {
  name: string;
  message: string;
  stack?: string;
}

export interface RequestRecord {
  id: string;
  requestId: string;
  timestamp: string;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestContentType: string;
  requestBody: BodyRecord | null;
  status: number | null;
  statusText: string;
  responseHeaders: Record<string, string> | null;
  responseContentType?: string;
  responseBody: BodyRecord | null;
  durationMs: number | null;
  error: NetworkError | null;
  state: "pending" | "complete" | "error";
}

export type RecordEventType = "start" | "update";
