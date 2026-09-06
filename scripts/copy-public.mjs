import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const source = resolve("src/public/index.html");
const destination = resolve("dist/src/public/index.html");
await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
