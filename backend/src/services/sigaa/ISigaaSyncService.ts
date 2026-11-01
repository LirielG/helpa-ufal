export interface ISigaaSyncService {
  syncIfNeeded(): Promise<void>;
  forceSync(): Promise<void>;
}
