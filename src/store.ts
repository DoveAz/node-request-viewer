import { appendFile, mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { RequestRecord } from "./types.js";

export interface RequestStore {
  directory: string;
  filePath: string;
  readAll(): Promise<RequestRecord[]>;
  append(record: RequestRecord): Promise<void>;
}

export async function createStore(outputDirectory: string): Promise<RequestStore> {
  const directory = resolve(outputDirectory);
  const filePath = resolve(directory, "requests.ndjson");
  await mkdir(directory, { recursive: true });

  async function readAll(): Promise<RequestRecord[]> {
    try {
      const content = await readFile(filePath, "utf8");
      if (!content.trim()) return [];
      const latest = new Map<string, RequestRecord>();
      for (const line of content.trim().split("\n")) {
        const record = JSON.parse(line) as RequestRecord;
        latest.set(record.id, record);
      }
      return [...latest.values()];
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
      throw error;
    }
  }

  async function append(record: RequestRecord): Promise<void> {
    await appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8");
  }

  return { directory, filePath, readAll, append };
}
