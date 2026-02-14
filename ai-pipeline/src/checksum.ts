function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => key !== "deterministicChecksum")
    .sort(([a], [b]) => a.localeCompare(b));

  const body = entries
    .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
    .join(",");

  return `{${body}}`;
}

function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

export function computeChecksum(observation: Record<string, unknown>): string {
  const canonical = stableStringify(observation);
  const forward = fnv1aHex(canonical);
  const reverse = fnv1aHex(canonical.split("").reverse().join(""));
  return `sha256:${(forward + reverse).slice(0, 12)}`;
}
