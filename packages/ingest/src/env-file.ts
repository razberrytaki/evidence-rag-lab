import { readFile } from "node:fs/promises";

const ENV_KEY_PATTERN = /^[A-Z_][A-Z0-9_]*$/;

export function parseEnvFile(raw: string): Record<string, string> {
  const parsed: Record<string, string> = {};

  for (const [index, originalLine] of raw.split(/\r?\n/).entries()) {
    const line = originalLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");
    if (separator === -1) {
      throw new Error(`invalid env line ${index + 1}: missing '='`);
    }

    const key = line.slice(0, separator).trim();
    if (!ENV_KEY_PATTERN.test(key)) {
      throw new Error(`invalid env key on line ${index + 1}: ${key}`);
    }

    parsed[key] = stripSurroundingQuotes(line.slice(separator + 1).trim());
  }

  return parsed;
}

export async function loadEnvFile(
  path: string,
  target: Record<string, string | undefined> = process.env
): Promise<Record<string, string>> {
  const parsed = parseEnvFile(await readFile(path, "utf8"));

  for (const [key, value] of Object.entries(parsed)) {
    if (target[key] === undefined) {
      target[key] = value;
    }
  }

  return parsed;
}

function stripSurroundingQuotes(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === "\"" && last === "\"") || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}
