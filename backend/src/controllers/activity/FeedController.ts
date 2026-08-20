import type { Request, Response } from "express";
import type { IFeedController } from "./IFeedController.js";
import type { IFeedService } from "@/services/activity/feed/IFeedService.js";
import type { IFeedFilters } from "@/types/activity.js";
import FeedService from "@/services/activity/feed/FeedService.js";

type Props = {
  feedService?: IFeedService;
};

export class FeedController implements IFeedController {
  private _feedService: IFeedService;

  constructor(props?: Props) {
    this._feedService = props?.feedService ?? new FeedService();
  }

  public async getFeed(req: Request, res: Response): Promise<void> {
    const filters = req.query as unknown as IFeedFilters;
    const feed = await this._feedService.getFeed(filters);
    res.status(200).json(feed);
  }
}

export default FeedController;
