import { Device } from './device';
import { Observation } from './observation';
import { Recommendation } from './recommendation';
import { PlaybookPatch } from './patch';

export interface SyncUpserts {
  observations: Observation[];
  recommendations: Recommendation[];
  playbookPatches: PlaybookPatch[];
}

export interface SyncBatchRequest {
  syncId: string;
  requestedAt: string;
  device: Device;
  lastKnownServerCursor: string;
  upserts: SyncUpserts;
}

export interface AcceptedCounts {
  observations: number;
  recommendations: number;
  playbookPatches: number;
}

export interface SyncConflict {
  entityType: 'observation' | 'recommendation' | 'playbookPatch';
  entityId: string;
  code: string;
  message: string;
}

export interface SyncDownstream {
  playbook: {
    playbookId: string;
    version: number;
    updatedAt: string;
  };
  observations: Observation[];
  recommendations: Recommendation[];
}

export interface SyncBatchResponse {
  syncId: string;
  acceptedAt: string;
  serverCursor: string;
  acceptedCounts: AcceptedCounts;
  conflicts: SyncConflict[];
  downstream: SyncDownstream;
}
