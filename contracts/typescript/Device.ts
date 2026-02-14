export type Platform = "ios" | "android";

export interface Device {
  deviceId: string;
  platform: Platform;
  appVersion: string;
  modelPackageVersion: string;
  offlineModeEnabled: boolean;
  lastSyncAt?: string | null;
  updatedAt: string;
}
