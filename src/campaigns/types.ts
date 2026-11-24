export interface CloudSave { id: string; name: string; revision: number; updatedAt: number }
export interface CloudList { account: string; saves: CloudSave[] }
export const CLOUD_MAX_BYTES = 10_000_000;
export const CLOUD_MAX_SAVES = 20;
