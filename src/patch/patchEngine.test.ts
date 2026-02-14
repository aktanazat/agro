import { describe, it, expect } from 'vitest';
import { validatePatch, applyPatch, applyPatchAndRecompute } from './patchEngine';
import { DEMO_PLAYBOOK, DEMO_OBSERVATION, DEMO_WEATHER_FEATURES, DEMO_PATCH } from '../fixtures';

describe('validatePatch', () => {
  it('validates canonical demo patch', () => {
    const { valid, errors } = validatePatch(DEMO_PATCH, DEMO_PLAYBOOK);
    expect(valid).toBe(true);
    expect(errors).toEqual([]);
  });

  it('rejects version mismatch', () => {
    const badPatch = { ...DEMO_PATCH, baseVersion: 999 };
    const { valid, errors } = validatePatch(badPatch, DEMO_PLAYBOOK);
    expect(valid).toBe(false);
    expect(errors[0]).toContain('version mismatch');
  });

  it('rejects out-of-bounds path', () => {
    const badPatch = {
      ...DEMO_PATCH,
      operations: [{ op: 'replace' as const, path: '/metadata/owner', value: 'x' }],
    };
    const { valid, errors } = validatePatch(badPatch, DEMO_PLAYBOOK);
    expect(valid).toBe(false);
    expect(errors[0]).toContain('not allowed');
  });
});

describe('applyPatch', () => {
  it('applies canonical patch and bumps version 3 -> 4', () => {
    const { result, updatedPlaybook } = applyPatch(
      DEMO_PATCH,
      DEMO_PLAYBOOK,
      '2026-02-11T18:21:14Z',
    );

    expect(result.status).toBe('applied');
    expect(result.oldVersion).toBe(3);
    expect(result.newVersion).toBe(4);
    expect(result.patchId).toBe('pch_20260211_0001');
    expect(updatedPlaybook).not.toBeNull();
    expect(updatedPlaybook!.version).toBe(4);
    expect(updatedPlaybook!.rules.rule_pm_moderate.constraints.maxWindKph).toBe(10);
  });

  it('returns rejected result for version mismatch', () => {
    const badPatch = { ...DEMO_PATCH, baseVersion: 999 };
    const { result, updatedPlaybook } = applyPatch(
      badPatch,
      DEMO_PLAYBOOK,
      '2026-02-11T18:21:14Z',
    );

    expect(result.status).toBe('rejected');
    expect(updatedPlaybook).toBeNull();
  });

  it('does not mutate original playbook', () => {
    const originalWind = DEMO_PLAYBOOK.rules.rule_pm_moderate.constraints.maxWindKph;
    applyPatch(DEMO_PATCH, DEMO_PLAYBOOK, '2026-02-11T18:21:14Z');
    expect(DEMO_PLAYBOOK.rules.rule_pm_moderate.constraints.maxWindKph).toBe(originalWind);
  });
});

describe('applyPatchAndRecompute', () => {
  const referenceTime = new Date('2026-02-11T19:00:00-08:00');

  it('patches playbook and generates new recommendation', () => {
    const { patchResult, newPlaybook, newRecommendation } =
      applyPatchAndRecompute(
        DEMO_PATCH,
        DEMO_PLAYBOOK,
        DEMO_OBSERVATION,
        DEMO_WEATHER_FEATURES,
        '2026-02-11T18:21:14Z',
        'rec_20260211_0002',
        referenceTime,
      );

    expect(patchResult.status).toBe('applied');
    expect(patchResult.newVersion).toBe(4);
    expect(patchResult.recomputedRecommendationId).toBe('rec_20260211_0002');
    expect(newPlaybook).not.toBeNull();
    expect(newPlaybook!.version).toBe(4);
    expect(newRecommendation).not.toBeNull();
    expect(newRecommendation!.recommendationId).toBe('rec_20260211_0002');
    expect(newRecommendation!.playbookVersion).toBe(4);
  });

  it('recomputed recommendation reflects tighter wind constraint', () => {
    const { newRecommendation } = applyPatchAndRecompute(
      DEMO_PATCH,
      DEMO_PLAYBOOK,
      DEMO_OBSERVATION,
      DEMO_WEATHER_FEATURES,
      '2026-02-11T18:21:14Z',
      'rec_20260211_0002',
      referenceTime,
    );

    // maxWindKph changed from 12 to 10 — drivers should reflect this
    expect(newRecommendation!.timingWindow.drivers).toContain('maxWindKph=10');
  });
});
