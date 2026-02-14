import type {
  ObservationExtraction,
  ObservationNormalization,
  ExtractionResult,
  Issue,
  Severity,
  LeafWetness,
} from "./types";

const BLOCK_PATTERN = /\b(block\s+\d+)\b/i;
const VARIETY_PATTERN = /\b(chardonnay|pinot\s*noir|cabernet|merlot|sauvignon\s*blanc|syrah|zinfandel)\b/i;

const ISSUE_SIGNALS: { pattern: RegExp; issue: Issue }[] = [
  { pattern: /powdery\s*mildew/i, issue: "powdery_mildew" },
  { pattern: /white\s+(powder|coating|patch|spots?)/i, issue: "powdery_mildew" },
  { pattern: /musty\s*odor/i, issue: "powdery_mildew" },
  { pattern: /heat\s*stress/i, issue: "heat_stress" },
  { pattern: /wilt(ing|ed)/i, issue: "heat_stress" },
  { pattern: /scorch(ed)?/i, issue: "heat_stress" },
  { pattern: /leaf\s*curl/i, issue: "heat_stress" },
];

const SEVERITY_SIGNALS: { pattern: RegExp; severity: Severity }[] = [
  { pattern: /\b(severe|heavy|extreme|extensive|everywhere)\b/i, severity: "high" },
  { pattern: /\b(moderate|medium|some|spreading)\b/i, severity: "moderate" },
  { pattern: /\b(mild|slight|early|minor|few|small|starting)\b/i, severity: "low" },
];

const LEAF_WETNESS_SIGNALS: { pattern: RegExp; wetness: LeafWetness }[] = [
  { pattern: /\b(wet|moist|rain|dew)\b/i, wetness: "wet" },
  { pattern: /\b(damp|humid)\b/i, wetness: "damp" },
  { pattern: /\b(dry)\b/i, wetness: "dry" },
];

const WIND_SIGNALS: { pattern: RegExp; kph: number }[] = [
  { pattern: /\b(strong|heavy|gusting)\s*wind/i, kph: 30 },
  { pattern: /\b(moderate)\s*wind/i, kph: 18 },
  { pattern: /\b(light|slight|calm)\s*(wind|breeze)/i, kph: 8 },
  { pattern: /wind\s*feels?\s*(light|slight)/i, kph: 8 },
  { pattern: /\bno\s*wind\b/i, kph: 2 },
  { pattern: /\bcalm\b/i, kph: 4 },
];

const TEMP_PATTERN = /(\d+)\s*C\b|temperature.*?(\d+)/;

const SYMPTOM_PATTERNS: RegExp[] = [
  /white\s+powder\s+on\s+[\w\s]+/i,
  /white\s+coating\s+covering\s+[\w\s]+/i,
  /white\s+(?:patches|spots)\s*(?:on\s+[\w\s]+)?/i,
  /small\s+white\s+spots\s+(?:on\s+[\w\s]+)?/i,
  /slight\s+musty\s+odor/i,
  /musty\s+odor/i,
  /leaves?\s+curling/i,
  /midday\s+leaf\s+curl/i,
  /wilting\s+(?:on|across)\s+[\w\s-]+/i,
  /severe\s+wilting\s+(?:across|on)\s+[\w\s]+/i,
  /leaves?\s+(?:scorched|brown)\s+(?:and\s+\w+\s+)?(?:at\s+[\w\s]+)?/i,
  /powdery\s+mildew\s+on\s+[\w\s]+/i,
  /(?:grapes?|vines?|leaves?)\s+look\s+\w+/i,
];

export function extractFromText(text: string, timestamp: string): ExtractionResult {
  const extraction = extractFields(text, timestamp);
  const normalization = extractNormalization(text);
  return { extraction, normalization };
}

function extractFields(text: string, timestamp: string): ObservationExtraction {
  const blockMatch = text.match(BLOCK_PATTERN);
  const fieldBlock = blockMatch ? blockMatch[1] : "unknown";

  const varietyMatch = text.match(VARIETY_PATTERN);
  const variety = varietyMatch ? varietyMatch[1].toLowerCase().replace(/\s+/g, " ") : undefined;

  const issue = detectIssue(text);
  const severity = detectSeverity(text, issue);
  const symptoms = extractSymptoms(text);

  const result: ObservationExtraction = {
    crop: "grape",
    fieldBlock,
    issue,
    severity,
    symptoms: symptoms.length > 0 ? symptoms : [text.slice(0, 60).trim()],
    observationTime: timestamp,
  };

  if (variety) {
    result.variety = variety;
  }

  return result;
}

function detectIssue(text: string): Issue {
  for (const { pattern, issue } of ISSUE_SIGNALS) {
    if (pattern.test(text)) return issue;
  }
  return "other";
}

function detectSeverity(text: string, issue: Issue): Severity {
  const hits = new Map<Severity, number>();
  for (const { pattern, severity } of SEVERITY_SIGNALS) {
    const matches = text.match(new RegExp(pattern.source, "gi"));
    if (matches) {
      hits.set(severity, (hits.get(severity) ?? 0) + matches.length);
    }
  }

  if (hits.size === 0) return issue === "other" ? "low" : "moderate";
  if (hits.size === 1) return hits.keys().next().value!;

  // Multiple conflicting signals: pick by count, ties go to moderate
  let best: Severity = "moderate";
  let bestCount = 0;
  for (const [severity, count] of hits) {
    if (count > bestCount || (count === bestCount && severity === "moderate")) {
      best = severity;
      bestCount = count;
    }
  }
  return best;
}

function extractSymptoms(text: string): string[] {
  const found: string[] = [];
  for (const pattern of SYMPTOM_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const symptom = match[0].trim().replace(/[.,;:!]+$/, "").replace(/\s+/g, " ");
      const isDuplicate = found.some((s) => {
        const a = s.toLowerCase();
        const b = symptom.toLowerCase();
        return a === b || a.includes(b) || b.includes(a);
      });
      if (!isDuplicate) {
        found.push(symptom);
      }
    }
  }
  return found;
}

function extractNormalization(text: string): ObservationNormalization {
  let leafWetness: LeafWetness = "unknown";
  for (const { pattern, wetness } of LEAF_WETNESS_SIGNALS) {
    if (pattern.test(text)) {
      leafWetness = wetness;
      break;
    }
  }

  let windEstimateKph = 10;
  for (const { pattern, kph } of WIND_SIGNALS) {
    if (pattern.test(text)) {
      windEstimateKph = kph;
      break;
    }
  }

  const result: ObservationNormalization = { leafWetness, windEstimateKph };

  const tempMatch = text.match(TEMP_PATTERN);
  if (tempMatch) {
    const temp = parseInt(tempMatch[1] || tempMatch[2], 10);
    if (temp >= -30 && temp <= 70) {
      result.temperatureC = temp;
    }
  }

  return result;
}
