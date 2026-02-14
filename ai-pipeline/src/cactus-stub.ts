import type { ObservationExtraction } from "./types";

export interface CactusRuntime {
  init(): Promise<void>;
  loadModel(modelId: string, quantization: string): Promise<void>;
  setDeterministicMode(enabled: boolean): void;
  generate(prompt: string, options: GenerateOptions): Promise<string>;
  dispose(): void;
}

interface GenerateOptions {
  temperature: number;
  maxTokens: number;
}

export interface CactusConfig {
  modelId: string;
  quantization: string;
  deterministic: boolean;
  maxTokens: number;
}

const DEFAULT_CONFIG: CactusConfig = {
  modelId: "cactus_extract_q4",
  quantization: "int4",
  deterministic: true,
  maxTokens: 256,
};

export const CACTUS_CONSTRAINTS = {
  maxRamBytes: 2 * 1024 * 1024 * 1024, // 2 GB
  maxModelFootprintBytes: 250 * 1024 * 1024, // 250 MB
  maxExtractionLatencyMs: 15_000, // 15 seconds
};

type CactusExtractResult =
  | { ok: true; extraction: ObservationExtraction }
  | { ok: false; reason: string };

export class CactusStub implements CactusRuntime {
  private initialized = false;
  private model: string | null = null;
  private deterministicMode = false;
  private config: CactusConfig;

  constructor(config?: Partial<CactusConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async init(): Promise<void> {
    this.initialized = true;
  }

  async loadModel(modelId: string, quantization: string): Promise<void> {
    if (!this.initialized) throw new Error("Runtime not initialized");
    this.model = `${modelId}:${quantization}`;
  }

  setDeterministicMode(enabled: boolean): void {
    this.deterministicMode = enabled;
  }

  async generate(_prompt: string, _options: GenerateOptions): Promise<string> {
    if (!this.model) throw new Error("No model loaded");
    // Stub: return empty JSON to force regex fallback
    return "{}";
  }

  dispose(): void {
    this.initialized = false;
    this.model = null;
  }

  isReady(): boolean {
    return this.initialized && this.model !== null;
  }
}

export function buildSchemaPrompt(rawNoteText: string): string {
  return [
    "Extract structured fields from this vineyard observation note.",
    "Return valid JSON matching the ObservationExtraction schema.",
    "Fields: crop (always 'grape'), variety, fieldBlock, issue (powdery_mildew|heat_stress|other),",
    "severity (low|moderate|high), symptoms (string[]), observationTime.",
    "",
    `Note: "${rawNoteText}"`,
    "",
    "JSON:",
  ].join("\n");
}

export async function tryExtractWithCactus(
  runtime: CactusRuntime,
  rawNoteText: string,
  timestamp: string,
): Promise<CactusExtractResult> {
  const prompt = buildSchemaPrompt(rawNoteText);

  let raw: string;
  try {
    raw = await runtime.generate(prompt, { temperature: 0, maxTokens: DEFAULT_CONFIG.maxTokens });
  } catch {
    return { ok: false, reason: "cactus_generate_failed" };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "cactus_json_parse_failed" };
  }

  if (!parsed.issue || !parsed.severity || !parsed.fieldBlock) {
    return { ok: false, reason: "cactus_incomplete_extraction" };
  }

  return {
    ok: true,
    extraction: {
      crop: "grape",
      variety: typeof parsed.variety === "string" ? parsed.variety : undefined,
      fieldBlock: String(parsed.fieldBlock),
      issue: parsed.issue as ObservationExtraction["issue"],
      severity: parsed.severity as ObservationExtraction["severity"],
      symptoms: Array.isArray(parsed.symptoms) ? parsed.symptoms.map(String) : [rawNoteText.slice(0, 60)],
      observationTime: timestamp,
    },
  };
}
