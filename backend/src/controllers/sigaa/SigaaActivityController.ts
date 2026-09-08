import type { Request, Response } from "express";
import type { ISigaaActivityController } from "./ISigaaActivityController.js";
import type { ISigaaActivityService } from "@/services/sigaa/ISigaaActivityService.js";
import type { SigaaActivityFilters } from "@/types/sigaa.js";
import SigaaActivityService from "@/services/sigaa/SigaaActivityService.js";

type Props = {
  sigaaActivityService?: ISigaaActivityService;
};

export class SigaaActivityController implements ISigaaActivityController {
  private _service: ISigaaActivityService;

  constructor(props?: Props) {
    this._service = props?.sigaaActivityService ?? new SigaaActivityService();
  }

  public async list(req: Request, res: Response): Promise<void> {
    const filters = req.query as unknown as SigaaActivityFilters;
    const result = await this._service.list(filters);
    res.status(200).json(result);
  }

  public async listFilters(req: Request, res: Response): Promise<void> {
    const options = await this._service.listFilterOptions();
    res.status(200).json(options);
  }
}

export default SigaaActivityController;
