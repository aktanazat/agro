import {
  Playbook,
  PlaybookPatch,
  PatchApplyResult,
  PatchOperation,
  Observation,
  WeatherFeatures,
  Recommendation,
} from '../types';
import { generateRecommendation } from '../engine/recommendationEngine';

export function validatePatch(
  patch: PlaybookPatch,
  playbook: Playbook,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check base version
  if (patch.baseVersion !== playbook.version) {
    errors.push(
      `Base version mismatch: expected ${playbook.version}, got ${patch.baseVersion}`,
    );
  }

  // Check operation paths against allowed editable paths
  const allEditablePaths = [
    ...playbook.rules.rule_pm_moderate.editablePaths,
    ...playbook.rules.rule_heat_moderate.editablePaths,
  ];

  for (const operation of patch.operations) {
    const isAllowed = allEditablePaths.some(
      (allowed) =>
        operation.path === allowed || operation.path.startsWith(allowed + '/'),
    );
    if (!isAllowed) {
      errors.push(`Path not allowed: ${operation.path}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function applyPatch(
  patch: PlaybookPatch,
  playbook: Playbook,
  appliedAt: string,
): { result: PatchApplyResult; updatedPlaybook: Playbook | null } {
  // Validate first
  const validation = validatePatch(patch, playbook);
  if (!validation.valid) {
    return {
      result: {
        patchId: patch.patchId,
        playbookId: playbook.playbookId,
        oldVersion: playbook.version,
        newVersion: playbook.version,
        status: 'rejected',
        validationErrors: validation.errors,
        recomputedRecommendationId: null,
        appliedAt,
      },
      updatedPlaybook: null,
    };
  }

  // Deep clone and apply operations
  let updated: Playbook = structuredClone(playbook);

  for (const operation of patch.operations) {
    updated = applyOperation(operation, updated);
  }

  // Bump version
  const newVersion = playbook.version + 1;
  updated = {
    ...updated,
    version: newVersion,
    updatedAt: appliedAt,
  };

  return {
    result: {
      patchId: patch.patchId,
      playbookId: playbook.playbookId,
      oldVersion: playbook.version,
      newVersion,
      status: 'applied',
      validationErrors: [],
      recomputedRecommendationId: null, // Caller sets this after recompute
      appliedAt,
    },
    updatedPlaybook: updated,
  };
}

export function applyPatchAndRecompute(
  patch: PlaybookPatch,
  playbook: Playbook,
  observation: Observation,
  weatherFeatures: WeatherFeatures,
  appliedAt: string,
  newRecommendationId: string,
  referenceTime: Date,
): {
  patchResult: PatchApplyResult;
  newPlaybook: Playbook | null;
  newRecommendation: Recommendation | null;
} {
  const { result, updatedPlaybook } = applyPatch(patch, playbook, appliedAt);

  if (result.status === 'rejected' || !updatedPlaybook) {
    return {
      patchResult: result,
      newPlaybook: null,
      newRecommendation: null,
    };
  }

  // Recompute recommendation with updated playbook
  const newRecommendation = generateRecommendation(
    observation,
    updatedPlaybook,
    weatherFeatures,
    newRecommendationId,
    referenceTime,
  );

  return {
    patchResult: {
      ...result,
      recomputedRecommendationId: newRecommendationId,
    },
    newPlaybook: updatedPlaybook,
    newRecommendation,
  };
}

function applyOperation(
  operation: PatchOperation,
  playbook: Playbook,
): Playbook {
  const clone = structuredClone(playbook);
  const segments = operation.path.split('/').filter(Boolean);

  // Navigate to parent
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let target: any = clone;
  for (let i = 0; i < segments.length - 1; i++) {
    target = target[segments[i]];
    if (target === undefined) {
      throw new Error(`Invalid path segment: ${segments[i]} in ${operation.path}`);
    }
  }

  const lastKey = segments[segments.length - 1];

  switch (operation.op) {
    case 'replace':
      if (!(lastKey in target)) {
        throw new Error(`Cannot replace non-existent key: ${lastKey}`);
      }
      target[lastKey] = operation.value;
      break;
    case 'add':
      target[lastKey] = operation.value;
      break;
    case 'remove':
      delete target[lastKey];
      break;
  }

  return clone;
}
