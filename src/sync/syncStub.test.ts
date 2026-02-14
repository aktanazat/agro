import { describe, it, expect } from 'vitest';
import { syncBatch } from './syncStub';
import { SyncBatchRequest } from '../types';

describe('syncStub', () => {
  const request: SyncBatchRequest = {
    syncId: 'sync_20260211_0001',
    requestedAt: '2026-02-11T18:22:00Z',
    device: {
      deviceId: 'dev_ios_001',
      platform: 'ios',
      appVersion: '0.1.0',
      modelPackageVersion: 'q4_2026_02',
      offlineModeEnabled: true,
      lastSyncAt: null,
      updatedAt: '2026-02-11T18:19:00Z',
    },
    lastKnownServerCursor: 'cur_20260211_0000',
    upserts: {
      observations: [],
      recommendations: [],
      playbookPatches: [],
    },
  };

  it('echoes syncId', async () => {
    const response = await syncBatch(request);
    expect(response.syncId).toBe('sync_20260211_0001');
  });

  it('returns correct accepted counts', async () => {
    const withData = {
      ...request,
      upserts: {
        observations: [{ observationId: 'obs_1' }] as any[],
        recommendations: [{ recommendationId: 'rec_1' }, { recommendationId: 'rec_2' }] as any[],
        playbookPatches: [],
      },
    };

    const response = await syncBatch(withData);
    expect(response.acceptedCounts.observations).toBe(1);
    expect(response.acceptedCounts.recommendations).toBe(2);
    expect(response.acceptedCounts.playbookPatches).toBe(0);
  });

  it('returns empty conflicts', async () => {
    const response = await syncBatch(request);
    expect(response.conflicts).toEqual([]);
  });
});
