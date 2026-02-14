import { PlaybookPatch } from '../types';

export const DEMO_PATCH: PlaybookPatch = {
  patchId: 'pch_20260211_0001',
  playbookId: 'pbk_yolo_grape',
  baseVersion: 3,
  requestedByDeviceId: 'dev_ios_001',
  requestedAt: '2026-02-11T18:21:12Z',
  reason: 'Tighten spray wind limit for tonight',
  operations: [
    {
      op: 'replace',
      path: '/rules/rule_pm_moderate/constraints/maxWindKph',
      value: 10,
      justification: 'Local gusts are increasing',
    },
  ],
};
