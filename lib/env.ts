import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Next loads .env.local for the app automatically; a script run through tsx
 * does not. Without this, `npm run eval:llm` silently falls back to the rules
 * driver with a key sitting right there in the file, and reports a result that
 * looks like a model score but isn't one.
 */
export function loadEnvLocal(dir = process.cwd()): void {
  for (const name of [".env.local", ".env"]) {
    const path = join(dir, name);
    if (!existsSync(path)) continue;
    for (const raw of readFileSync(path, "utf8").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key && process.env[key] === undefined) process.env[key] = val;
    }
  }
}
