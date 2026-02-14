import { createHash } from "crypto";

export function computeChecksum(observation: Record<string, unknown>): string {
  const { deterministicChecksum: _, ...rest } = observation;
  const canonical = JSON.stringify(rest, Object.keys(rest).sort());
  const hash = createHash("sha256").update(canonical).digest("hex").slice(0, 12).toUpperCase();
  return `sha256:${hash}`;
}
