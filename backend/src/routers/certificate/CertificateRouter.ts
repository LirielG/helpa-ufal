import express from "express";
import CertificateController from "@/controllers/certificate/CertificateController.js";
import AuthMiddleware from "@/middlewares/auth/AuthMiddleware.js";
import { certificateValidationRateLimiter } from "@/middlewares/rateLimit/publicRateLimiters.js";

const router = express.Router();
const certificateController = new CertificateController();
const authMiddleware = new AuthMiddleware();

// No param validation on purpose: a malformed id must answer the same 404 as
// an unknown or someone else's certificate, never a 400 INVALID_UUID.
router.get(
  "/certificates/:certificateId/file",
  authMiddleware.auth({ userTypes: "all" }),
  (req, res, next) => certificateController.downloadFile(req, res).catch(next),
);

// Public on purpose: whoever checks a certificate has no HELPA account, and a
// stale session cookie in their browser must not turn the answer into a 401.
router.get(
  "/certificate-validations/:validationCode",
  certificateValidationRateLimiter,
  (req, res, next) => certificateController.validate(req, res).catch(next),
);

export default router;
