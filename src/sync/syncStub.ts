import { SyncBatchRequest, SyncBatchResponse } from '../types';

export async function syncBatch(
  request: SyncBatchRequest,
): Promise<SyncBatchResponse> {
  return {
    syncId: request.syncId,
    acceptedAt: new Date().toISOString(),
    serverCursor: `cur_${request.requestedAt.slice(0, 10).replace(/-/g, '')}_0001`,
    acceptedCounts: {
      observations: request.upserts.observations.length,
      recommendations: request.upserts.recommendations.length,
      playbookPatches: request.upserts.playbookPatches.length,
    },
    conflicts: [],
    downstream: {
      playbook: {
        playbookId: 'pbk_yolo_grape',
        version: 4,
        updatedAt: request.requestedAt,
      },
      observations: [],
      recommendations: [],
    },
  };
}
