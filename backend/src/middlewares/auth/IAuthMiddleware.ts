import type { RequestHandler } from "express";
import type { AuthorizeOptions } from "@/types/auth.js";

export interface IAuthMiddleware {
  requireAuth(options?: AuthorizeOptions): RequestHandler;
  optionalAuth(): RequestHandler;
}
