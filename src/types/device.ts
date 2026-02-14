export interface Device {
  deviceId: string;
  platform: 'ios' | 'android';
  appVersion: string;
  modelPackageVersion: string;
  offlineModeEnabled: boolean;
  lastSyncAt: string | null;
  updatedAt: string;
}
