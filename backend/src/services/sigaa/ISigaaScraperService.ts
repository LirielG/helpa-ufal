import type { ScrapedSigaaActivity } from "@/types/sigaa.js";

export interface ISigaaScraperService {
  scrapeCurrentYearActivities(): Promise<ScrapedSigaaActivity[]>;
}
