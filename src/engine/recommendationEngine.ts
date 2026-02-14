import {
  Observation,
  Playbook,
  PlaybookRule,
  WeatherFeatures,
  Recommendation,
  RiskFlag,
  Issue,
  Severity,
  RuleWeatherAdjustment,
} from '../types';

interface TimingWindow {
  start: Date;
  end: Date;
}

export function generateRecommendation(
  observation: Observation,
  playbook: Playbook,
  weatherFeatures: WeatherFeatures,
  recommendationId: string,
  referenceTime: Date,
): Recommendation {
  const rule = selectRule(
    playbook,
    observation.extraction.issue,
    observation.extraction.severity,
  );
  if (!rule) {
    throw new Error(
      `No matching rule for issue=${observation.extraction.issue} severity=${observation.extraction.severity}`,
    );
  }

  let window = calculateBaseWindow(rule, referenceTime);

  const rationale: string[] = [];
  window = adjustForWeather(window, weatherFeatures, rule, rationale);

  const riskFlags = evaluateConstraints(rule, weatherFeatures);
  const drivers = buildDriversList(weatherFeatures, rule);
  const confidence = calculateConfidence(weatherFeatures);

  return {
    recommendationId,
    observationId: observation.observationId,
    playbookId: playbook.playbookId,
    playbookVersion: playbook.version,
    weatherFeaturesId: weatherFeatures.weatherFeaturesId,
    generatedAt: new Date().toISOString(),
    issue: observation.extraction.issue,
    severity: observation.extraction.severity,
    action: rule.action.instructions,
    rationale,
    timingWindow: {
      startAt: formatPacificISO(window.start),
      endAt: formatPacificISO(window.end),
      localTimezone: 'America/Los_Angeles',
      confidence,
      drivers,
    },
    riskFlags,
    requiredConfirmation: true,
    status: 'pending_confirmation',
  };
}

export function selectRule(
  playbook: Playbook,
  issue: Issue,
  _severity: Severity,
): PlaybookRule | null {
  switch (issue) {
    case 'powdery_mildew':
      return playbook.rules.rule_pm_moderate;
    case 'heat_stress':
      return playbook.rules.rule_heat_moderate;
    default:
      return null;
  }
}

function calculateBaseWindow(
  rule: PlaybookRule,
  referenceTime: Date,
): TimingWindow {
  const startMs =
    rule.timing.baseWindowHours.startOffsetHours * 3600 * 1000;
  const endMs = rule.timing.baseWindowHours.endOffsetHours * 3600 * 1000;

  return {
    start: new Date(referenceTime.getTime() + startMs),
    end: new Date(referenceTime.getTime() + endMs),
  };
}

function shouldApplyAdjustment(
  adjustment: RuleWeatherAdjustment,
  weatherFeatures: WeatherFeatures,
): boolean {
  switch (adjustment.feature) {
    case 'inversionPresent':
      return weatherFeatures.inversionPresent && adjustment.condition === 'true';
    case 'humidityLayering':
      return weatherFeatures.humidityLayering === adjustment.condition;
    case 'windShearProxy':
      return weatherFeatures.windShearProxy === adjustment.condition;
    case 'sprayWindowScore': {
      const threshold = parseFloat(
        adjustment.condition.replace('< ', '').replace('<', ''),
      );
      return !isNaN(threshold) && weatherFeatures.sprayWindowScore < threshold;
    }
    case 'diseaseRiskScore':
      return weatherFeatures.diseaseRiskScore > 0.6;
    case 'heatStressScore':
      return weatherFeatures.heatStressScore > 0.6;
    default:
      return false;
  }
}

function adjustForWeather(
  window: TimingWindow,
  weatherFeatures: WeatherFeatures,
  rule: PlaybookRule,
  rationale: string[],
): TimingWindow {
  const adjusted = { start: new Date(window.start), end: new Date(window.end) };

  for (const adjustment of rule.timing.weatherAdjustments) {
    if (shouldApplyAdjustment(adjustment, weatherFeatures)) {
      adjusted.start = new Date(
        adjusted.start.getTime() + adjustment.shiftStartMinutes * 60 * 1000,
      );
      adjusted.end = new Date(
        adjusted.end.getTime() + adjustment.shiftEndMinutes * 60 * 1000,
      );
      rationale.push(adjustment.rationaleTag);
    }
  }

  if (rationale.length === 0) {
    rationale.push('standard_timing');
  }

  return adjusted;
}

function evaluateConstraints(
  _rule: PlaybookRule,
  weatherFeatures: WeatherFeatures,
): RiskFlag[] {
  const flags: RiskFlag[] = [];

  if (weatherFeatures.sourceMode === 'none') {
    flags.push('weather_data_missing');
  }
  if (weatherFeatures.windShearProxy === 'high') {
    flags.push('high_drift_risk');
  }
  if (weatherFeatures.sprayWindowScore < 0.4) {
    flags.push('low_confidence');
  }

  return flags;
}

function buildDriversList(
  weatherFeatures: WeatherFeatures,
  rule: PlaybookRule,
): string[] {
  const drivers: string[] = [];

  drivers.push(`inversionPresent=${weatherFeatures.inversionPresent}`);
  drivers.push(`humidityLayering=${weatherFeatures.humidityLayering}`);
  drivers.push(`windShearProxy=${weatherFeatures.windShearProxy}`);
  drivers.push(`maxWindKph=${Math.round(rule.constraints.maxWindKph)}`);

  return drivers;
}

function calculateConfidence(weatherFeatures: WeatherFeatures): number {
  let confidence = 0.9;

  if (weatherFeatures.sourceMode === 'demo') {
    confidence -= 0.05;
  }
  if (weatherFeatures.windShearProxy === 'high') {
    confidence -= 0.1;
  }
  if (weatherFeatures.humidityLayering === 'unknown') {
    confidence -= 0.1;
  }

  return Math.max(0.5, confidence);
}

function formatPacificISO(date: Date): string {
  // Format as ISO-8601 with America/Los_Angeles offset
  const pacificOffset = getPacificOffset(date);
  const offsetMs = pacificOffset * 60 * 1000;
  const local = new Date(date.getTime() - offsetMs);

  const year = local.getUTCFullYear();
  const month = String(local.getUTCMonth() + 1).padStart(2, '0');
  const day = String(local.getUTCDate()).padStart(2, '0');
  const hours = String(local.getUTCHours()).padStart(2, '0');
  const minutes = String(local.getUTCMinutes()).padStart(2, '0');
  const seconds = String(local.getUTCSeconds()).padStart(2, '0');

  const offsetHours = String(Math.abs(Math.floor(pacificOffset / 60))).padStart(
    2,
    '0',
  );
  const offsetMinutes = String(Math.abs(pacificOffset % 60)).padStart(2, '0');
  const sign = pacificOffset <= 0 ? '+' : '-';

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMinutes}`;
}

function getPacificOffset(date: Date): number {
  // Returns offset in minutes from UTC for America/Los_Angeles
  // PST = UTC-8 (480 min), PDT = UTC-7 (420 min)
  // DST: second Sunday in March to first Sunday in November
  const year = date.getUTCFullYear();
  const marchSecondSunday = getNthSunday(year, 2, 2); // March, 2nd Sunday
  const novFirstSunday = getNthSunday(year, 10, 1); // November, 1st Sunday

  // DST transitions at 2:00 AM local = 10:00 AM UTC (PST+8)
  const dstStart = new Date(
    Date.UTC(year, 2, marchSecondSunday, 10, 0, 0),
  );
  const dstEnd = new Date(
    Date.UTC(year, 10, novFirstSunday, 9, 0, 0),
  );

  if (date >= dstStart && date < dstEnd) {
    return 420; // PDT: UTC-7
  }
  return 480; // PST: UTC-8
}

function getNthSunday(year: number, month: number, n: number): number {
  let count = 0;
  for (let day = 1; day <= 31; day++) {
    const d = new Date(Date.UTC(year, month, day));
    if (d.getUTCMonth() !== month) break;
    if (d.getUTCDay() === 0) {
      count++;
      if (count === n) return day;
    }
  }
  return 1;
}
