export type PlaybookCrop = "grape";
export type PlaybookRegion = "yolo_county_ca";
export type RuleIssue = "powdery_mildew" | "heat_stress";
export type RuleSeverity = "low" | "moderate" | "high";
export type ActionType = "spray" | "irrigate" | "monitor";

export type AdjustmentFeature =
  | "inversionPresent"
  | "humidityLayering"
  | "windShearProxy"
  | "sprayWindowScore"
  | "diseaseRiskScore"
  | "heatStressScore";

export interface Playbook {
  playbookId: string;
  crop: PlaybookCrop;
  region: PlaybookRegion;
  version: number;
  updatedAt: string;
  rules: {
    rule_pm_moderate: PlaybookRule;
    rule_heat_moderate: PlaybookRule;
  };
}

export interface PlaybookRule {
  ruleId: string;
  issue: RuleIssue;
  severity: RuleSeverity;
  constraints: RuleConstraints;
  action: RuleAction;
  timing: RuleTiming;
  editablePaths: string[];
}

export interface RuleConstraints {
  maxWindKph: number;
  avoidInversion?: boolean;
  maxRelativeHumidityPct?: number;
  minHoursWithoutRain?: number;
  maxTemperatureC?: number;
  irrigationWindowLocal?: string;
}

export interface RuleAction {
  type: ActionType;
  instructions: string;
}

export interface RuleTiming {
  baseWindowHours: {
    startOffsetHours: number;
    endOffsetHours: number;
  };
  weatherAdjustments: RuleWeatherAdjustment[];
}

export interface RuleWeatherAdjustment {
  feature: AdjustmentFeature;
  condition: string;
  shiftStartMinutes: number;
  shiftEndMinutes: number;
  rationaleTag: string;
}
