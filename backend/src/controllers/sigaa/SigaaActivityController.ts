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

  public async listDepartments(req: Request, res: Response): Promise<void> {
    const departments = await this._service.listDepartments();
    res.status(200).json({ departments });
  }
}

export default SigaaActivityController;
