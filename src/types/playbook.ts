export type AdjustmentFeature =
  | 'inversionPresent'
  | 'humidityLayering'
  | 'windShearProxy'
  | 'sprayWindowScore'
  | 'diseaseRiskScore'
  | 'heatStressScore';

export type ActionType = 'spray' | 'irrigate' | 'monitor';

export interface BaseWindowHours {
  startOffsetHours: number;
  endOffsetHours: number;
}

export interface RuleWeatherAdjustment {
  feature: AdjustmentFeature;
  condition: string;
  shiftStartMinutes: number;
  shiftEndMinutes: number;
  rationaleTag: string;
}

export interface RuleTiming {
  baseWindowHours: BaseWindowHours;
  weatherAdjustments: RuleWeatherAdjustment[];
}

export interface RuleAction {
  type: ActionType;
  instructions: string;
}

export interface RuleConstraints {
  maxWindKph: number;
  avoidInversion?: boolean;
  maxRelativeHumidityPct?: number;
  minHoursWithoutRain?: number;
  maxTemperatureC?: number;
  irrigationWindowLocal?: string;
}

export interface PlaybookRule {
  ruleId: string;
  issue: 'powdery_mildew' | 'heat_stress';
  severity: 'low' | 'moderate' | 'high';
  constraints: RuleConstraints;
  action: RuleAction;
  timing: RuleTiming;
  editablePaths: string[];
}

export interface PlaybookRules {
  rule_pm_moderate: PlaybookRule;
  rule_heat_moderate: PlaybookRule;
}

export interface Playbook {
  playbookId: string;
  crop: 'grape';
  region: 'yolo_county_ca';
  version: number;
  updatedAt: string;
  rules: PlaybookRules;
}
