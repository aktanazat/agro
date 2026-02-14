export type PatchOperationType = "add" | "replace" | "remove";

export interface PlaybookPatch {
  patchId: string;
  playbookId: string;
  baseVersion: number;
  requestedByDeviceId: string;
  requestedAt: string;
  reason: string;
  operations: PlaybookPatchOperation[];
}

export interface PlaybookPatchOperation {
  op: PatchOperationType;
  path: string;
  value?: unknown;
  justification?: string;
}
