import type { ISigaaSyncService } from "./ISigaaSyncService.js";
import type { ISigaaScraperService } from "./ISigaaScraperService.js";
import type { ISigaaActivityRepository } from "@/repositories/sigaa/ISigaaActivityRepository.js";
import SigaaScraperService from "./SigaaScraperService.js";
import SigaaActivityRepository from "@/repositories/sigaa/SigaaActivityRepository.js";
import { env } from "@/config/env.js";

const DEFAULT_CACHE_TTL_MS =
  (Number(process.env.SIGAA_CACHE_TTL_HOURS) || 12) * 60 * 60 * 1000;

type Props = {
  scraperService?: ISigaaScraperService;
  activityRepository?: ISigaaActivityRepository;
  cacheTtlMs?: number;
  syncEnabled?: boolean;
};

export class SigaaSyncService implements ISigaaSyncService {
  private _scraperService: ISigaaScraperService;
  private _activityRepository: ISigaaActivityRepository;
  private _cacheTtlMs: number;
  private _syncEnabled: boolean;
  private _inFlightSync: Promise<void> | null = null;

  constructor(props?: Props) {
    this._scraperService = props?.scraperService ?? new SigaaScraperService();
    this._activityRepository =
      props?.activityRepository ?? new SigaaActivityRepository();
    this._cacheTtlMs = props?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this._syncEnabled = props?.syncEnabled ?? env.SIGAA_SYNC_ENABLED;
  }

  public async syncIfNeeded(): Promise<void> {
    // Only the implicit sync obeys the switch: forceSync stays a force.
    if (!this._syncEnabled) return;

    try {
      const latestLastSeenAt =
        await this._activityRepository.getLatestLastSeenAt();

      if (latestLastSeenAt) {
        const ageMs = Date.now() - latestLastSeenAt.getTime();
        if (ageMs < this._cacheTtlMs) {
          // Cache is still valid, no need to scrape again
          return;
        }
      }

      await this.forceSync();
    } catch (error) {
      console.error("[SigaaSyncService] Error during syncIfNeeded:", error);
      // Graceful degradation: don't break the application to serve existing data
    }
  }

  public async forceSync(): Promise<void> {
    // If a sync is already in progress, wait for the same Promise
    if (this._inFlightSync) {
      return this._inFlightSync;
    }

    this._inFlightSync = (async () => {
      try {
        const syncTimestamp = new Date();
        const scraped =
          await this._scraperService.scrapeCurrentYearActivities();

        if (scraped.length > 0) {
          await this._activityRepository.upsertMany(scraped, syncTimestamp);
          await this._activityRepository.markInactiveBefore(syncTimestamp);
        }
      } catch (error) {
        console.error("[SigaaSyncService] Error during forceSync:", error);
      } finally {
        this._inFlightSync = null;
      }
    })();

    return this._inFlightSync;
  }
}

export default SigaaSyncService;
