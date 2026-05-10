import type { RequestHandler } from "express";
import type { AuthorizeOptions } from "@/types/auth.js";

export interface IAuthMiddleware {
  auth(options?: AuthorizeOptions): RequestHandler;
}
