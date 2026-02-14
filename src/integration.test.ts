import { describe, it, expect } from 'vitest';
import { generateRecommendation } from './engine/recommendationEngine';
import { applyPatchAndRecompute } from './patch/patchEngine';
import { loadDemoWeatherFeatures } from './weather/weatherAdapter';
import { DEMO_PLAYBOOK, DEMO_PATCH } from './fixtures';
import { Observation } from './types';

// Person B's canonical output — loaded directly from their fixture
const personBObservation: Observation = {
  observationId: 'obs_20260211_0001',
  deviceId: 'dev_ios_001',
  createdAt: '2026-02-11T10:30:00-08:00',
  captureMode: 'voice',
  rawNoteText:
    'Block 7 Chardonnay. I see white powder on upper leaf surfaces, moderate spread after two warm days. Leaves are dry right now, slight musty odor, wind feels light. Log this and give me a spray window tonight.',
  transcription: {
    text: 'Block 7 Chardonnay. I see white powder on upper leaf surfaces, moderate spread after two warm days. Leaves are dry right now, slight musty odor, wind feels light. Log this and give me a spray window tonight.',
    source: 'on_device_asr',
    confidence: 0.93,
  },
  extraction: {
    crop: 'grape',
    variety: 'chardonnay',
    fieldBlock: 'Block 7',
    issue: 'powdery_mildew',
    severity: 'moderate',
    symptoms: ['white powder on upper leaf surfaces', 'slight musty odor'],
    observationTime: '2026-02-11T10:30:00-08:00',
  },
  normalization: {
    leafWetness: 'dry',
    windEstimateKph: 8,
  },
  location: {
    lat: 38.2919,
    lon: -122.458,
  },
  status: 'confirmed',
  schemaVersion: '1.0.0',
  deterministicChecksum: 'sha256:8179F83398C1',
};

describe('Integration: Person B → Person C', () => {
  const referenceTime = new Date('2026-02-11T19:00:00-08:00');
  const weather = loadDemoWeatherFeatures();

  it('Person B observation produces a valid recommendation', () => {
    const rec = generateRecommendation(
      personBObservation,
      DEMO_PLAYBOOK,
      weather,
      'rec_20260211_0001',
      referenceTime,
    );

    expect(rec.recommendationId).toBe('rec_20260211_0001');
    expect(rec.observationId).toBe('obs_20260211_0001');
    expect(rec.issue).toBe('powdery_mildew');
    expect(rec.severity).toBe('moderate');
    expect(rec.action).toBe(
      'Apply sulfur-based contact spray in affected block.',
    );
    expect(rec.playbookVersion).toBe(3);
    expect(rec.requiredConfirmation).toBe(true);
    expect(rec.status).toBe('pending_confirmation');
    expect(rec.rationale).toContain('high_humidity_persistence');
    expect(rec.timingWindow.startAt).toContain('21:00:00');
    expect(rec.timingWindow.localTimezone).toBe('America/Los_Angeles');
    expect(rec.riskFlags).toEqual([]);
  });

  it('Patch + recompute works with Person B observation', () => {
    const { patchResult, newPlaybook, newRecommendation } =
      applyPatchAndRecompute(
        DEMO_PATCH,
        DEMO_PLAYBOOK,
        personBObservation,
        weather,
        '2026-02-11T18:21:14Z',
        'rec_20260211_0002',
        referenceTime,
      );

    expect(patchResult.status).toBe('applied');
    expect(patchResult.oldVersion).toBe(3);
    expect(patchResult.newVersion).toBe(4);
    expect(newPlaybook!.rules.rule_pm_moderate.constraints.maxWindKph).toBe(10);
    expect(newRecommendation!.recommendationId).toBe('rec_20260211_0002');
    expect(newRecommendation!.playbookVersion).toBe(4);
    expect(newRecommendation!.timingWindow.drivers).toContain('maxWindKph=10');
  });
});
