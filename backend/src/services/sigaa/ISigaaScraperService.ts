import type { IScrapedSigaaActivity } from "@/types/sigaa.js";

export interface ISigaaScraperService {
  scrapeCurrentYearActivities(): Promise<IScrapedSigaaActivity[]>;
}
