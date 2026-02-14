import { JSONValue } from './common';

export type PatchOp = 'add' | 'replace' | 'remove';
export type PatchApplyStatus = 'applied' | 'rejected';

export interface PatchOperation {
  op: PatchOp;
  path: string;
  value?: JSONValue;
  justification?: string;
}

export interface PlaybookPatch {
  patchId: string;
  playbookId: string;
  baseVersion: number;
  requestedByDeviceId: string;
  requestedAt: string;
  reason: string;
  operations: PatchOperation[];
}

export interface PatchApplyResult {
  patchId: string;
  playbookId: string;
  oldVersion: number;
  newVersion: number;
  status: PatchApplyStatus;
  validationErrors: string[];
  recomputedRecommendationId: string | null;
  appliedAt: string;
}
